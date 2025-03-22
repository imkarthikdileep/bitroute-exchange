
// This is a simplified version for UI demonstration purposes
// A real implementation would need proper WebRTC peer connection setup

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
export function formatFileSize(bytes: number): string {
  if (bytes === 0) return '0 Bytes';
  
  const k = 1024;
  const sizes = ['Bytes', 'KB', 'MB', 'GB', 'TB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  
  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
}
