import { ChangeEvent, DragEvent, useState } from "react";
import { FileTransferProgress, WebRTCFileTransfer, formatFileSize } from "@/lib/webrtc";
import { ProgressBar } from "./ProgressBar";
import { Upload, X, Check, FileCode } from "lucide-react";

interface FileUploadProps {
  webrtc: WebRTCFileTransfer;
}

export function FileUpload({ webrtc }: FileUploadProps) {
  const [isDragging, setIsDragging] = useState(false);
  const [transferFiles, setTransferFiles] = useState<FileTransferProgress[]>([]);

  const handleFileSelection = (files: FileList | null) => {
    if (!files) return;
    
    webrtc.addFiles(Array.from(files), (progress) => {
      setTransferFiles(prev => {
        // Find if file already exists in the list
        const existingIndex = prev.findIndex(f => f.id === progress.id);
        if (existingIndex >= 0) {
          // Update existing entry
          return prev.map((item, index) => 
            index === existingIndex ? progress : item
          );
        } else {
          // Add new entry
          return [...prev, progress];
        }
      });
    });
  };

  const handleDragOver = (e: DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    setIsDragging(true);
  };

  const handleDragLeave = () => {
    setIsDragging(false);
  };

  const handleDrop = (e: DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    setIsDragging(false);
    handleFileSelection(e.dataTransfer.files);
  };

  const handleFileInput = (e: ChangeEvent<HTMLInputElement>) => {
    handleFileSelection(e.target.files);
  };

  const removeFile = (id: string) => {
    webrtc.cancelTransfer(id);
    setTransferFiles(prev => prev.filter(file => file.id !== id));
  };

  return (
    <div className="w-full max-w-3xl mx-auto space-y-6">
      <div 
        className={`
          w-full h-60 rounded-xl border-2 border-dashed transition-all-300
          flex flex-col items-center justify-center gap-4 cursor-pointer
          ${isDragging 
            ? "border-primary bg-primary/5" 
            : "border-border hover:border-primary/50 hover:bg-secondary/50"
          }
        `}
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
        onClick={() => document.getElementById("file-input")?.click()}
      >
        <Upload size={40} className="text-muted-foreground" />
        <div className="text-center">
          <p className="text-lg font-medium">Drag & drop files here</p>
          <p className="text-sm text-muted-foreground mt-1">or click to select files</p>
        </div>
        <input 
          id="file-input" 
          type="file" 
          multiple 
          className="hidden" 
          onChange={handleFileInput}
        />
      </div>

      {transferFiles.length > 0 && (
        <div className="space-y-4 mt-8">
          <h3 className="text-lg font-medium">Transfer Progress</h3>
          <div className="space-y-4">
            {transferFiles.map((file) => (
              <div key={file.id} className="glass-card p-4 rounded-lg space-y-2">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-lg bg-secondary flex items-center justify-center">
                      <FileCode size={20} />
                    </div>
                    <div>
                      <p className="font-medium">{file.filename}</p>
                      <p className="text-xs text-muted-foreground">{formatFileSize(file.size)}</p>
                    </div>
                  </div>
                  {file.status === 'completed' ? (
                    <Check size={20} className="text-green-500" />
                  ) : (
                    <button 
                      className="p-1.5 hover:bg-secondary rounded-full transition-colors"
                      onClick={() => removeFile(file.id)}
                    >
                      <X size={16} />
                    </button>
                  )}
                </div>
                <ProgressBar progress={file.progress} />
                <p className="text-xs text-right text-muted-foreground">
                  {file.status === 'completed' 
                    ? 'Completed' 
                    : `${file.progress}% - ${file.status}`
                  }
                  {file.speed && file.status === 'transferring' && ` - ${formatFileSize(file.speed)}/s`}
                  {file.timeRemaining && file.status === 'transferring' && 
                    ` - ${Math.ceil(file.timeRemaining)}s remaining`
                  }
                </p>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
