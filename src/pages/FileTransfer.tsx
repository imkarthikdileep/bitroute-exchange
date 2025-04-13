import { Navbar } from "@/components/Navbar";
import { FileUpload } from "@/components/FileUpload";
import { ArrowLeft, Copy, Link2 } from "lucide-react";
import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { WebRTCFileTransfer } from "@/lib/webrtc";
import { useState, useEffect } from "react";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { useToast } from "@/components/ui/use-toast";

const FileTransfer = () => {
  const [connectionStatus, setConnectionStatus] = useState<'disconnected' | 'connecting' | 'connected'>('disconnected');
  const [shareableLink, setShareableLink] = useState<string>('');
  const [error, setError] = useState<string>('');
  const { toast } = useToast();
  const [webrtc] = useState(() => new WebRTCFileTransfer());

  const createRoom = async () => {
    try {
      setConnectionStatus('connecting');
      setError('');
      const link = await webrtc.createRoom();
      setShareableLink(link);
      setConnectionStatus('connected');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to create room');
      setConnectionStatus('disconnected');
    }
  };

  const copyLink = async () => {
    try {
      await navigator.clipboard.writeText(shareableLink);
      toast({
        description: "Link copied to clipboard",
      });
    } catch (err) {
      toast({
        variant: "destructive",
        description: "Failed to copy link",
      });
    }
  };

  useEffect(() => {
    // Check if we're joining a room
    const params = new URLSearchParams(window.location.search);
    const roomId = params.get('room');
    
    if (roomId) {
      setConnectionStatus('connecting');
      webrtc.joinRoom(roomId, (file) => {
        // Handle received file
        console.log('Received file:', file);
      }).then(() => {
        setConnectionStatus('connected');
      }).catch((err) => {
        setError(err.message);
        setConnectionStatus('disconnected');
      });
    }

    return () => {
      webrtc.disconnect();
    };
  }, []);

  return (
    <div className="min-h-screen flex flex-col">
      <Navbar />
      
      <main className="flex-1 pt-24 px-6">
        <div className="container max-w-7xl mx-auto py-8">
          <Link to="/" className="inline-flex items-center gap-2 text-sm hover:text-primary transition-colors mb-8">
            <ArrowLeft size={16} />
            <span>Back to Home</span>
          </Link>
          
          <div className="space-y-6 animate-fade-in">
            <div className="space-y-2">
              <h1 className="text-3xl font-bold">Transfer Files</h1>
              <p className="text-muted-foreground">
                Securely send files to anyone with a shareable link. No account required.
              </p>
            </div>

            {error && (
              <Alert variant="destructive">
                <AlertDescription>{error}</AlertDescription>
              </Alert>
            )}

            <div className="space-y-4">
              {connectionStatus === 'disconnected' && !shareableLink && (
                <Button onClick={createRoom}>
                  Create Room
                </Button>
              )}

              {connectionStatus === 'connecting' && (
                <div className="flex items-center gap-2 text-muted-foreground">
                  <div className="animate-spin rounded-full h-4 w-4 border-2 border-primary border-t-transparent"></div>
                  Establishing connection...
                </div>
              )}

              {shareableLink && (
                <div className="flex flex-col gap-4">
                  <div className="flex items-center gap-2">
                    <Link2 className="text-primary" size={20} />
                    <span className="font-medium">Room created successfully!</span>
                  </div>
                  
                  <div className="flex items-center gap-2">
                    <code className="flex-1 bg-muted p-2 rounded-md text-sm break-all">
                      {shareableLink}
                    </code>
                    <Button variant="outline" size="icon" onClick={copyLink}>
                      <Copy size={16} />
                    </Button>
                  </div>
                  
                  <p className="text-sm text-muted-foreground">
                    Share this link with the person you want to send files to.
                  </p>
                </div>
              )}

              {connectionStatus === 'connected' && (
                <div className="space-y-4">
                  <FileUpload webrtc={webrtc} />
                </div>
              )}
            </div>
            
            <div className="glass-card rounded-xl p-6 mt-8">
              <h3 className="text-lg font-medium mb-4">How it Works</h3>
              <ol className="space-y-4 ml-5 list-decimal">
                <li className="text-muted-foreground">
                  <span className="text-foreground font-medium">Select or drop files</span> – 
                  Choose files from your device or drag and drop them into the upload area.
                </li>
                <li className="text-muted-foreground">
                  <span className="text-foreground font-medium">Generate link</span> – 
                  BitRoute creates a secure, temporary link for your files.
                </li>
                <li className="text-muted-foreground">
                  <span className="text-foreground font-medium">Share</span> – 
                  Send the link to your recipient through any messaging platform.
                </li>
                <li className="text-muted-foreground">
                  <span className="text-foreground font-medium">Transfer</span> – 
                  When they open the link, a secure peer-to-peer connection is established.
                </li>
              </ol>
            </div>
          </div>
        </div>
      </main>
      
      <footer className="py-6 px-6 border-t mt-auto">
        <div className="container max-w-7xl mx-auto">
          <p className="text-sm text-muted-foreground text-center">
            Files are transferred directly between devices and are never stored on our servers.
          </p>
        </div>
      </footer>
    </div>
  );
};

export default FileTransfer;
