
import { Navbar } from "@/components/Navbar";
import { FileUpload } from "@/components/FileUpload";
import { ArrowLeft } from "lucide-react";
import { Link } from "react-router-dom";

const FileTransfer = () => {
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
            
            <div className="glass-card rounded-xl p-8 mt-6">
              <FileUpload />
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
