import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card } from "@/components/ui/card";
import { Menu, LogOut, Search, Folder, FileText, MoreVertical } from "lucide-react";

interface FileItem {
  name: string;
  type: "folder" | "file";
  size: string;
  date: string;
}

interface FileManagerProps {
  containerName: string;
  currentPath: string;
  files: FileItem[];
  onLogout: () => void;
  onBack: () => void;
  onNavigate: (path: string) => void;
}

const FileManager = ({
  containerName,
  currentPath,
  files,
  onLogout,
  onBack,
  onNavigate
}: FileManagerProps) => {
  const [searchQuery, setSearchQuery] = useState("");

  const filteredFiles = files.filter(file =>
    file.name.toLowerCase().includes(searchQuery.toLowerCase())
  );

  return (
    <div className="min-h-screen bg-background p-6">
      <header className="flex justify-between items-center mb-8">
        <div className="flex items-center gap-4">
          <Button 
            onClick={onBack}
            variant="ghost"
            className="text-foreground hover:bg-muted"
          >
            <Menu className="w-6 h-6" />
          </Button>
          <h1 className="text-4xl font-bold text-golden">File Manager</h1>
        </div>
        <Button 
          onClick={onLogout}
          className="bg-primary hover:bg-primary/90 text-primary-foreground rounded-2xl px-6"
        >
          <LogOut className="w-4 h-4 mr-2" />
          LOG OUT
        </Button>
      </header>

      {/* Location and Search */}
      <div className="mb-6 space-y-4">
        <div className="flex items-center gap-2 text-golden">
          <span className="font-medium">Lokasi:</span>
          <span className="font-mono">{currentPath}</span>
        </div>
        
        <div className="relative max-w-md">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-5 h-5 text-muted-foreground" />
          <Input
            type="text"
            placeholder="Canva"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-10 h-12 bg-destructive border-border rounded-2xl text-foreground placeholder:text-muted-foreground"
          />
        </div>
      </div>

      {/* File List */}
      <Card className="bg-card border-border rounded-2xl overflow-hidden">
        <div className="divide-y divide-border">
          {filteredFiles.map((file, index) => (
            <div 
              key={index}
              className="flex items-center justify-between p-4 hover:bg-muted/50 transition-colors cursor-pointer"
              onClick={() => file.type === "folder" && onNavigate(`${currentPath}/${file.name}`)}
            >
              <div className="flex items-center gap-4 flex-1">
                <div className="w-8 h-8 flex items-center justify-center">
                  {file.type === "folder" ? (
                    <Folder className="w-6 h-6 text-files-folder" />
                  ) : (
                    <FileText className="w-6 h-6 text-files-document" />
                  )}
                </div>
                
                <div className="flex-1">
                  <div className="bg-container rounded-full px-4 py-2">
                    <span className="text-container-foreground font-medium">
                      {file.name}
                    </span>
                  </div>
                </div>
                
                <div className="text-container-foreground text-sm font-mono w-24 text-right">
                  {file.size}
                </div>
                
                <div className="text-container-foreground text-sm w-24 text-right">
                  {file.date}
                </div>
                
                <Button variant="ghost" size="sm" className="text-foreground hover:bg-muted">
                  <MoreVertical className="w-4 h-4" />
                </Button>
              </div>
            </div>
          ))}
          
          {filteredFiles.length === 0 && (
            <div className="p-8 text-center text-muted-foreground">
              No files found
            </div>
          )}
        </div>
      </Card>
    </div>
  );
};

export default FileManager;