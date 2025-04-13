// This is a simplified version for UI demonstration purposes
// A real implementation would need proper WebRTC peer connection setup

// webrtc-file-transfer.ts

export interface FileTransferProgress {
  id: string;
  filename: string;
  progress: number;
  size: number;
  status: 'preparing' | 'transferring' | 'completed' | 'error';
  speed?: number; // bytes per second
  timeRemaining?: number; // seconds
}

export interface PeerConnection {
  connection: RTCPeerConnection;
  dataChannel?: RTCDataChannel;
  transfersInProgress: Map<string, FileTransfer>;
}

interface FileTransfer {
  id: string;
  file: File;
  buffer: ArrayBuffer;
  sendProgress: number;
  receiveProgress: number;
  chunkSize: number;
  startTime: number;
  bytesTransferred: number;
  lastUpdateTime: number;
  lastBytes: number;
  speed: number;
  onProgress: (progress: FileTransferProgress) => void;
  status: 'preparing' | 'transferring' | 'completed' | 'error';
}

// Signal server URLs with fallback
const SIGNAL_SERVERS = [
  import.meta.env.VITE_SIGNAL_SERVER_URL,
  'wss://bitroute-signaling.herokuapp.com',
  'wss://bitroute-fallback.onrender.com'
];

// Configuration for the WebRTC connection
const iceServers = {
  iceServers: [
    { urls: 'stun:stun.l.google.com:19302' },
    { urls: 'stun:stun1.l.google.com:19302' },
    // Add TURN servers for fallback in restrictive networks
    {
      urls: [
        'turn:a.relay.metered.ca:80',
        'turn:a.relay.metered.ca:80?transport=tcp',
        'turn:a.relay.metered.ca:443',
        'turn:a.relay.metered.ca:443?transport=tcp'
      ],
      username: 'e8e9e953f454d975e462a697',  // Replace with your actual credentials
      credential: 'R+g+k/n6knTV8Gwi'
    }
  ]
};

// Encryption related interfaces
interface EncryptionKeys {
  publicKey: JsonWebKey;
  privateKey: CryptoKey;
}

interface EncryptedData {
  iv: Uint8Array;
  data: ArrayBuffer;
}

// Crypto utilities
class CryptoUtils {
  static async generateKeyPair(): Promise<EncryptionKeys> {
    const keyPair = await window.crypto.subtle.generateKey(
      {
        name: "RSA-OAEP",
        modulusLength: 2048,
        publicExponent: new Uint8Array([1, 0, 1]),
        hash: "SHA-256",
      },
      true,
      ["encrypt", "decrypt"]
    );

    const publicKey = await window.crypto.subtle.exportKey(
      "jwk",
      keyPair.publicKey
    );

    return {
      publicKey,
      privateKey: keyPair.privateKey
    };
  }

  static async importPublicKey(jwk: JsonWebKey): Promise<CryptoKey> {
    return await window.crypto.subtle.importKey(
      "jwk",
      jwk,
      {
        name: "RSA-OAEP",
        hash: "SHA-256",
      },
      true,
      ["encrypt"]
    );
  }

  static async encryptData(data: ArrayBuffer, publicKey: CryptoKey): Promise<EncryptedData> {
    const iv = window.crypto.getRandomValues(new Uint8Array(12));
    const key = await window.crypto.subtle.generateKey(
      { name: "AES-GCM", length: 256 },
      true,
      ["encrypt"]
    );

    const encryptedData = await window.crypto.subtle.encrypt(
      { name: "AES-GCM", iv },
      key,
      data
    );

    const exportedKey = await window.crypto.subtle.exportKey("raw", key);
    const encryptedKey = await window.crypto.subtle.encrypt(
      { name: "RSA-OAEP" },
      publicKey,
      exportedKey
    );

    const combined = new Uint8Array(encryptedKey.byteLength + encryptedData.byteLength);
    combined.set(new Uint8Array(encryptedKey), 0);
    combined.set(new Uint8Array(encryptedData), encryptedKey.byteLength);

    return {
      iv,
      data: combined.buffer
    };
  }

  static async decryptData(
    encryptedData: EncryptedData,
    privateKey: CryptoKey
  ): Promise<ArrayBuffer> {
    const data = new Uint8Array(encryptedData.data);
    const encryptedKey = data.slice(0, 256); // RSA-2048 encrypted key is 256 bytes
    const actualData = data.slice(256);

    const keyData = await window.crypto.subtle.decrypt(
      { name: "RSA-OAEP" },
      privateKey,
      encryptedKey
    );

    const key = await window.crypto.subtle.importKey(
      "raw",
      keyData,
      { name: "AES-GCM", length: 256 },
      false,
      ["decrypt"]
    );

    return await window.crypto.subtle.decrypt(
      { name: "AES-GCM", iv: encryptedData.iv },
      key,
      actualData
    );
  }
}

export class WebRTCFileTransfer {
  private ws: WebSocket | null = null;
  private currentServerIndex: number = 0;
  private peerConnection: PeerConnection | null = null;
  private localSessionDescription: RTCSessionDescription | null = null;
  private roomId: string | null = null;
  private isSender: boolean = false;
  private transferQueue: File[] = [];
  private isProcessingQueue: boolean = false;
  private encryptionKeys: EncryptionKeys | null = null;
  private peerPublicKey: JsonWebKey | null = null;
  
  // Dynamic chunk size calculation based on file size
  private getOptimalChunkSize(fileSize: number): number {
    if (fileSize < 1024 * 1024) { // < 1MB
      return 64 * 1024; // 64KB (increased from 16KB)
    } else if (fileSize < 10 * 1024 * 1024) { // < 10MB
      return 256 * 1024; // 256KB (increased from 64KB)
    } else if (fileSize < 100 * 1024 * 1024) { // < 100MB
      return 1024 * 1024; // 1MB (increased from 256KB)
    } else {
      return 2 * 1024 * 1024; // 2MB for very large files (increased from 1MB)
    }
  }

  // Create and return a shareable link for receivers
  public async createRoom(): Promise<string> {
    return new Promise((resolve, reject) => {
      // Add connection timeout
      const timeout = setTimeout(() => {
        if (this.ws) {
          this.ws.close();
        }
        reject(new Error('Connection timeout - please try again'));
      }, 15000); // 15 second timeout

      this.isSender = true;
      this.roomId = this.generateRoomId();
      
      try {
        // Connect to signaling server
        this.connectToSignalingServer().then((ws) => {
          this.ws = ws;
          
          this.ws.onopen = () => {
            if (this.ws) {
              this.ws.send(JSON.stringify({
                type: 'create',
                roomId: this.roomId
              }));
            }
          };
          
          this.ws.onmessage = async (event) => {
            try {
              const message = JSON.parse(event.data);
              
              if (message.type === 'room_created') {
                clearTimeout(timeout);
                // Room created, create P2P connection
                await this.setupSenderPeerConnection();
                const shareableLink = `${window.location.origin}/receive?room=${this.roomId}`;
                resolve(shareableLink);
              } else if (message.type === 'error') {
                clearTimeout(timeout);
                reject(new Error(message.message || 'Failed to create room'));
              } else if (message.type === 'answer') {
                // Receiver has sent their SDP answer
                await this.handleReceiverAnswer(message.sdp);
              } else if (message.type === 'ice_candidate') {
                // Add ICE candidate from receiver
                if (this.peerConnection) {
                  await this.peerConnection.connection.addIceCandidate(
                    new RTCIceCandidate(message.candidate)
                  );
                }
              }
            } catch (error) {
              clearTimeout(timeout);
              reject(new Error('Invalid response from server'));
            }
          };
          
          this.ws.onerror = (error) => {
            clearTimeout(timeout);
            reject(new Error('Connection failed - please check your internet connection'));
          };

          this.ws.onclose = () => {
            clearTimeout(timeout);
            reject(new Error('Connection closed unexpectedly'));
          };
        }).catch((error) => {
          clearTimeout(timeout);
          reject(new Error('Failed to establish connection'));
        });
      } catch (error) {
        clearTimeout(timeout);
        reject(new Error('Failed to establish connection'));
      }
    });
  }
  
  // Join an existing room as a receiver
  public async joinRoom(roomId: string, onFileReceived: (file: File) => void): Promise<void> {
    return new Promise((resolve, reject) => {
      this.isSender = false;
      this.roomId = roomId;
      
      // Connect to signaling server
      this.connectToSignalingServer().then((ws) => {
        this.ws = ws;
        
        this.ws.onopen = () => {
          if (this.ws) {
            this.ws.send(JSON.stringify({
              type: 'join',
              roomId: this.roomId
            }));
          }
        };
        
        this.ws.onmessage = async (event) => {
          const message = JSON.parse(event.data);
          
          if (message.type === 'room_joined') {
            await this.setupReceiverPeerConnection(onFileReceived);
            resolve();
          } else if (message.type === 'offer') {
            // Received SDP offer from sender
            await this.handleSenderOffer(message.sdp, message.publicKey);
          } else if (message.type === 'ice_candidate') {
            // Add ICE candidate from sender
            if (this.peerConnection) {
              await this.peerConnection.connection.addIceCandidate(
                new RTCIceCandidate(message.candidate)
              );
            }
          } else if (message.type === 'error') {
            reject(new Error(message.message));
          }
        };
        
        this.ws.onerror = (error) => {
          reject(error);
        };
      }).catch((error) => {
        reject(error);
      });
    });
  }
  
  // Add files to the transfer queue
  public addFiles(files: File[], onProgress: (progress: FileTransferProgress) => void): void {
    for (const file of files) {
      this.transferQueue.push(file);
      onProgress({
        id: this.generateFileId(),
        filename: file.name,
        progress: 0,
        size: file.size,
        status: 'preparing'
      });
    }
    
    if (!this.isProcessingQueue) {
      this.processQueue(onProgress);
    }
  }
  
  // Process the file transfer queue
  private async processQueue(onProgress: (progress: FileTransferProgress) => void): Promise<void> {
    if (this.transferQueue.length === 0) {
      this.isProcessingQueue = false;
      return;
    }
    
    this.isProcessingQueue = true;
    const file = this.transferQueue.shift()!;
    
    try {
      await this.sendFile(file, onProgress);
      
      // Process next file after a short delay
      setTimeout(() => {
        this.processQueue(onProgress);
      }, 500);
    } catch (error) {
      console.error('Error sending file:', error);
      
      // Try to continue with next file
      setTimeout(() => {
        this.processQueue(onProgress);
      }, 1000);
    }
  }
  
  // Send a file to the receiver
  private async sendFile(file: File, onProgress: (progress: FileTransferProgress) => void): Promise<void> {
    return new Promise(async (resolve, reject) => {
      if (!this.peerConnection?.dataChannel || !this.peerPublicKey) {
        reject(new Error('No peer connection established or missing encryption keys'));
        return;
      }
      
      try {
        const peerPublicKey = await CryptoUtils.importPublicKey(this.peerPublicKey);
        const fileId = this.generateFileId();
        const chunkSize = this.getOptimalChunkSize(file.size);
        const fileReader = new FileReader();
        let offset = 0;
        
        const fileTransfer: FileTransfer = {
          id: fileId,
          file,
          buffer: new ArrayBuffer(0),
          sendProgress: 0,
          receiveProgress: 0,
          chunkSize,
          startTime: Date.now(),
          bytesTransferred: 0,
          lastUpdateTime: Date.now(),
          lastBytes: 0,
          speed: 0,
          onProgress,
          status: 'preparing'
        };
        
        this.peerConnection.transfersInProgress.set(fileId, fileTransfer);
        
        // Initial file info message
        this.peerConnection.dataChannel.send(JSON.stringify({
          type: 'file_info',
          id: fileId,
          name: file.name,
          size: file.size,
          chunkSize
        }));

        fileReader.onload = async (e) => {
          if (this.peerConnection?.dataChannel.readyState !== 'open') {
            reject(new Error('Data channel not open'));
            return;
          }

          const processChunk = async () => {
            if (this.peerConnection?.dataChannel.bufferedAmount > 8388608) {
              setTimeout(processChunk, 100);
              return;
            }

            if (e.target?.result instanceof ArrayBuffer) {
              const encryptedData = await CryptoUtils.encryptData(e.target.result, peerPublicKey);
              
              // Send encrypted chunk
              this.peerConnection.dataChannel.send(JSON.stringify({
                type: 'chunk_header',
                id: fileId,
                iv: Array.from(encryptedData.iv),
                size: encryptedData.data.byteLength
              }));
              this.peerConnection.dataChannel.send(encryptedData.data);
              
              // Update progress
              offset += chunkSize;
              const progress = Math.min(100, Math.round((offset / file.size) * 100));
              
              updateProgress(progress, offset);
              
              if (offset < file.size) {
                readNextChunk();
              } else {
                fileTransfer.status = 'completed';
                this.peerConnection.dataChannel.send(JSON.stringify({
                  type: 'file_complete',
                  id: fileId
                }));
                resolve();
              }
            }
          };

          processChunk();
        };

        const updateProgress = (progress: number, offset: number) => {
          const now = Date.now();
          const timeElapsed = (now - fileTransfer.lastUpdateTime) / 1000;
          
          if (timeElapsed > 0.2) {
            const bytesSinceLast = offset - fileTransfer.lastBytes;
            fileTransfer.speed = bytesSinceLast / timeElapsed;
            fileTransfer.lastBytes = offset;
            fileTransfer.lastUpdateTime = now;
            
            onProgress({
              id: fileId,
              filename: file.name,
              progress,
              size: file.size,
              status: progress === 100 ? 'completed' : 'transferring',
              speed: fileTransfer.speed,
              timeRemaining: (file.size - offset) / fileTransfer.speed
            });
          }
        };

        const readNextChunk = () => {
          const slice = file.slice(offset, offset + chunkSize);
          fileReader.readAsArrayBuffer(slice);
        };

        readNextChunk();
      } catch (error) {
        reject(new Error('Encryption failed: ' + error.message));
      }
    });
  }
  
  // Setup the WebRTC peer connection for the sender
  private async setupSenderPeerConnection(): Promise<void> {
    // Generate encryption keys
    this.encryptionKeys = await CryptoUtils.generateKeyPair();
    
    // Create RTCPeerConnection
    const connection = new RTCPeerConnection(iceServers);
    
    this.peerConnection = {
      connection,
      transfersInProgress: new Map()
    };
    
    // Create data channel for file transfer
    const dataChannel = connection.createDataChannel('fileTransfer', {
      ordered: true,
      maxRetransmits: 3,
      maxPacketLifeTime: 3000
    });
    
    this.peerConnection.dataChannel = dataChannel;
    this.setupDataChannel(dataChannel);

    // Create promise to wait for ICE gathering
    const gatheringComplete = new Promise<void>((resolve) => {
      const checkState = () => {
        if (connection.iceGatheringState === 'complete') {
          resolve();
        }
      };
      connection.onicegatheringstatechange = checkState;
      checkState();
    });
    
    // Handle ICE candidates
    connection.onicecandidate = (event) => {
      if (event.candidate && this.ws) {
        this.ws.send(JSON.stringify({
          type: 'ice_candidate',
          roomId: this.roomId,
          candidate: event.candidate
        }));
      }
    };
    
    // Create offer SDP
    const offer = await connection.createOffer();
    await connection.setLocalDescription(offer);
    
    // Wait for ICE gathering to complete
    await gatheringComplete;
    
    this.localSessionDescription = connection.localDescription;
    
    // Send offer and public key to signaling server
    if (this.ws && this.localSessionDescription) {
      this.ws.send(JSON.stringify({
        type: 'offer',
        roomId: this.roomId,
        sdp: this.localSessionDescription,
        publicKey: this.encryptionKeys.publicKey // Include public key in offer
      }));
    }
  }
  
  // Setup the WebRTC peer connection for the receiver
  private async setupReceiverPeerConnection(onFileReceived: (file: File) => void): Promise<void> {
    // Create RTCPeerConnection
    const connection = new RTCPeerConnection(iceServers);
    
    this.peerConnection = {
      connection,
      transfersInProgress: new Map()
    };
    
    // Handle incoming data channel
    connection.ondatachannel = (event) => {
      this.peerConnection!.dataChannel = event.channel;
      this.setupReceiverDataChannel(event.channel, onFileReceived);
    };
    
    // Handle ICE candidates
    connection.onicecandidate = (event) => {
      if (event.candidate && this.ws) {
        this.ws.send(JSON.stringify({
          type: 'ice_candidate',
          roomId: this.roomId,
          candidate: event.candidate
        }));
      }
    };
  }
  
  // Configure the data channel for the sender
  private setupDataChannel(dataChannel: RTCDataChannel): void {
    dataChannel.onopen = () => {
      console.log('Data channel is open');
    };
    
    dataChannel.onclose = () => {
      console.log('Data channel is closed');
    };
    
    dataChannel.onerror = (error) => {
      console.error('Data channel error:', error);
    };
    
    // Handle acknowledgments from the receiver
    dataChannel.onmessage = (event) => {
      try {
        const message = JSON.parse(event.data);
        
        if (message.type === 'ack' && message.id) {
          const transfer = this.peerConnection?.transfersInProgress.get(message.id);
          if (transfer) {
            // Update receiver's progress
            transfer.receiveProgress = message.progress;
          }
        }
      } catch (error) {
        console.error('Error parsing message:', error);
      }
    };
  }
  
  // Configure the data channel for the receiver
  private setupReceiverDataChannel(dataChannel: RTCDataChannel, onFileReceived: (file: File) => void): void {
    dataChannel.onopen = () => {
      console.log('Data channel is open');
    };
    
    dataChannel.onclose = () => {
      console.log('Data channel is closed');
    };
    
    dataChannel.onerror = (error) => {
      console.error('Data channel error:', error);
    };
    
    let currentFileInfo: any = null;
    let receiveBuffer: ArrayBuffer[] = [];
    let receivedBytes = 0;
    
    // Handle incoming file data
    dataChannel.onmessage = async (event) => {
      // If the message is a string, it's a control message
      if (typeof event.data === 'string') {
        try {
          const message = JSON.parse(event.data);
          
          if (message.type === 'file_info') {
            // New file transfer started
            currentFileInfo = message;
            receiveBuffer = [];
            receivedBytes = 0;
            
            // Create a new file transfer object
            const fileTransfer: FileTransfer = {
              id: message.id,
              file: new File([], message.name),
              buffer: new ArrayBuffer(0),
              sendProgress: 0,
              receiveProgress: 0,
              chunkSize: message.chunkSize,
              startTime: Date.now(),
              bytesTransferred: 0,
              lastUpdateTime: Date.now(),
              lastBytes: 0,
              speed: 0,
              onProgress: () => {}, // No-op for receiver
              status: 'transferring'
            };
            
            this.peerConnection?.transfersInProgress.set(message.id, fileTransfer);
          } else if (message.type === 'chunk') {
            // The next message will be a chunk of the file
            // This is a header for the binary data that follows
          } else if (message.type === 'file_complete') {
            // File transfer completed
            if (currentFileInfo) {
              // Combine all chunks into a single buffer
              const completeBuffer = new Uint8Array(receivedBytes);
              let offset = 0;
              
              for (const buffer of receiveBuffer) {
                completeBuffer.set(new Uint8Array(buffer), offset);
                offset += buffer.byteLength;
              }
              
              // Create the File object
              const file = new File([completeBuffer], currentFileInfo.name, {
                type: this.getMimeType(currentFileInfo.name)
              });
              
              // Notify application that file is received
              onFileReceived(file);
              
              // Clear buffers
              receiveBuffer = [];
              receivedBytes = 0;
              currentFileInfo = null;
            }
          }
        } catch (error) {
          console.error('Error parsing message:', error);
        }
      } else if (event.data instanceof ArrayBuffer) {
        const data = new Uint8Array(event.data);
        const headerLength = data[0];
        
        if (headerLength > 0) {
          // Extract header and chunk data
          const headerBytes = data.slice(1, headerLength + 1);
          const header = JSON.parse(new TextDecoder().decode(headerBytes));
          const chunkData = data.slice(headerLength + 1);
          
          if (header.type === 'chunk' && currentFileInfo) {
            receiveBuffer.push(chunkData.buffer);
            receivedBytes += chunkData.byteLength;
            
            // Calculate progress
            const progress = Math.round((receivedBytes / currentFileInfo.size) * 100);
            
            // Send acknowledgment to sender
            dataChannel.send(JSON.stringify({
              type: 'ack',
              id: currentFileInfo.id,
              progress
            }));
          }
        } else {
          // Handle legacy binary data format
          if (currentFileInfo) {
            receiveBuffer.push(event.data);
            receivedBytes += event.data.byteLength;
            
            const progress = Math.round((receivedBytes / currentFileInfo.size) * 100);
            dataChannel.send(JSON.stringify({
              type: 'ack',
              id: currentFileInfo.id,
              progress
            }));
          }
        }
      }
    };
  }
  
  // Handle the SDP answer from the receiver
  private async handleReceiverAnswer(sdp: RTCSessionDescriptionInit): Promise<void> {
    if (this.peerConnection) {
      await this.peerConnection.connection.setRemoteDescription(new RTCSessionDescription(sdp));
    }
  }
  
  // Handle the SDP offer from the sender
  private async handleSenderOffer(sdp: RTCSessionDescriptionInit, publicKey?: JsonWebKey): Promise<void> {
    if (this.peerConnection) {
      if (publicKey) {
        this.peerPublicKey = publicKey;
      }
      this.encryptionKeys = await CryptoUtils.generateKeyPair();
      
      await this.peerConnection.connection.setRemoteDescription(new RTCSessionDescription(sdp));
      const answer = await this.peerConnection.connection.createAnswer();
      await this.peerConnection.connection.setLocalDescription(answer);
      
      if (this.ws) {
        this.ws.send(JSON.stringify({
          type: 'answer',
          roomId: this.roomId,
          sdp: answer,
          publicKey: this.encryptionKeys.publicKey
        }));
      }
    }
  }
  
  // Generate a unique room ID
  private generateRoomId(): string {
    return Math.random().toString(36).substring(2, 15) + Math.random().toString(36).substring(2, 15);
  }
  
  // Generate a unique file ID
  private generateFileId(): string {
    return Math.random().toString(36).substring(2, 9);
  }
  
  // Get MIME type from file extension
  private getMimeType(filename: string): string {
    const extension = filename.split('.').pop()?.toLowerCase();
    
    // Common MIME types
    const mimeTypes: { [key: string]: string } = {
      'jpg': 'image/jpeg',
      'jpeg': 'image/jpeg',
      'png': 'image/png',
      'gif': 'image/gif',
      'mp3': 'audio/mpeg',
      'mp4': 'video/mp4',
      'pdf': 'application/pdf',
      'doc': 'application/msword',
      'docx': 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      'xls': 'application/vnd.ms-excel',
      'xlsx': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      'zip': 'application/zip',
      'txt': 'text/plain',
      'html': 'text/html',
      'csv': 'text/csv'
    };
    
    return extension && extension in mimeTypes 
      ? mimeTypes[extension] 
      : 'application/octet-stream';
  }
  
  // Cancel all transfers and clean up resources
  public disconnect(): void {
    // Close data channel
    if (this.peerConnection?.dataChannel) {
      this.peerConnection.dataChannel.close();
    }
    
    // Close WebRTC connection
    if (this.peerConnection) {
      this.peerConnection.connection.close();
    }
    
    // Close WebSocket connection
    if (this.ws) {
      this.ws.close();
    }
    
    // Clear all state
    this.peerConnection = null;
    this.ws = null;
    this.localSessionDescription = null;
    this.roomId = null;
    this.transferQueue = [];
    this.isProcessingQueue = false;
  }
  
  // Cancel a specific file transfer
  public cancelTransfer(fileId: string): void {
    if (this.peerConnection?.dataChannel && this.peerConnection.transfersInProgress.has(fileId)) {
      // Notify the other peer about cancellation
      this.peerConnection.dataChannel.send(JSON.stringify({
        type: 'cancel',
        id: fileId
      }));
      
      // Remove from transfers in progress
      this.peerConnection.transfersInProgress.delete(fileId);
      
      // Remove from queue if it's there
      this.transferQueue = this.transferQueue.filter(file => {
        const transfer = this.peerConnection?.transfersInProgress.get(fileId);
        return transfer && transfer.file !== file;
      });
    }
  }

  private async connectToSignalingServer(): Promise<WebSocket> {
    const maxRetries = 3;
    let lastError: Error | null = null;

    for (let retry = 0; retry < maxRetries; retry++) {
      for (let i = 0; i < SIGNAL_SERVERS.length; i++) {
        const serverUrl = SIGNAL_SERVERS[(this.currentServerIndex + i) % SIGNAL_SERVERS.length];
        try {
          const ws = new WebSocket(serverUrl);
          await new Promise((resolve, reject) => {
            const timeout = setTimeout(() => reject(new Error('Connection timeout')), 5000);
            ws.onopen = () => {
              clearTimeout(timeout);
              resolve(ws);
            };
            ws.onerror = (error) => {
              clearTimeout(timeout);
              reject(error);
            };
          });
          this.currentServerIndex = (this.currentServerIndex + i) % SIGNAL_SERVERS.length;
          return ws;
        } catch (error) {
          lastError = error as Error;
          continue;
        }
      }
      // Wait before retry
      await new Promise(resolve => setTimeout(resolve, 1000));
    }
    throw lastError || new Error('Failed to connect to any signaling server');
  }
}
export interface FileTransferProgress {
  id: string;
  filename: string;
  progress: number;
  size: number;
  status: 'preparing' | 'transferring' | 'completed' | 'error';
}

// Simulate file transfer progress for UI demonstration
export function simulateFileTransfer(
  file: File,
  onProgress: (progress: FileTransferProgress) => void
): { cancel: () => void } {
  const id = Math.random().toString(36).substring(2, 9);
  const totalSteps = 100;
  let currentStep = 0;
  
  onProgress({
    id,
    filename: file.name,
    progress: 0,
    size: file.size,
    status: 'preparing'
  });
  
  // Wait a moment before starting the transfer
  setTimeout(() => {
    onProgress({
      id,
      filename: file.name,
      progress: 0,
      size: file.size,
      status: 'transferring'
    });
    
    const interval = setInterval(() => {
      currentStep += 1;
      const progress = Math.round((currentStep / totalSteps) * 100);
      
      onProgress({
        id,
        filename: file.name,
        progress,
        size: file.size,
        status: progress === 100 ? 'completed' : 'transferring'
      });
      
      if (progress === 100) {
        clearInterval(interval);
      }
    }, 100); // Update every 100ms for smooth progress
    
    return () => clearInterval(interval);
  }, 500);
  
  return {
    cancel: () => {
      // Logic to cancel transfer would go here
      console.log(`Transfer ${id} cancelled`);
    }
  };
}

// Format file size in a human-readable way
export function formatfileSize(bytes: number): string {
  if (bytes === 0) return '0 Bytes';
  
  const k = 1024;
  const sizes = ['Bytes', 'KB', 'MB', 'GB', 'TB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  
  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
}

// Format file size to human readable format
export function formatFileSize(bytes: number): string {
  const units = ['B', 'KB', 'MB', 'GB', 'TB'];
  let size = bytes;
  let unitIndex = 0;
  
  while (size >= 1024 && unitIndex < units.length - 1) {
    size /= 1024;
    unitIndex++;
  }
  
  return `${size.toFixed(1)} ${units[unitIndex]}`;
}
