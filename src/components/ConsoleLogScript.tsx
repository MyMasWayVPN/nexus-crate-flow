import { useState, useEffect, useRef } from "react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Menu, LogOut, Play, RotateCcw, Square, Download, Trash2 } from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import { useContainer } from "@/contexts/ContainerContext";
import { apiService } from "@/services/api";
import { useToast } from "@/hooks/use-toast";

interface ConsoleLogScriptProps {
  containerName: string;
  containerId: string;
  onBack: () => void;
}

const ConsoleLogScript = ({
  containerName,
  containerId,
  onBack
}: ConsoleLogScriptProps) => {
  const [logs, setLogs] = useState<string[]>([]);
  const [isConnected, setIsConnected] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const wsRef = useRef<WebSocket | null>(null);
  const terminalRef = useRef<HTMLDivElement>(null);
  const { logout } = useAuth();
  const { startContainer, stopContainer, restartContainer } = useContainer();
  const { toast } = useToast();

  // Load initial logs
  useEffect(() => {
    loadLogs();
    connectWebSocket();
    
    return () => {
      if (wsRef.current) {
        wsRef.current.close();
      }
    };
  }, [containerId]);

  // Auto-scroll to bottom when new logs arrive
  useEffect(() => {
    if (terminalRef.current) {
      terminalRef.current.scrollTop = terminalRef.current.scrollHeight;
    }
  }, [logs]);

  const loadLogs = async () => {
    try {
      const response = await apiService.getContainerLogs(containerId, { lines: 100 });
      setLogs(response.logs || []);
    } catch (error) {
      console.error('Failed to load logs:', error);
      toast({
        title: "Gagal memuat log",
        description: error instanceof Error ? error.message : "Terjadi kesalahan",
        variant: "destructive",
      });
    }
  };

  const connectWebSocket = () => {
    try {
      const ws = apiService.createLogWebSocket(containerId);
      
      ws.onopen = () => {
        setIsConnected(true);
        console.log('WebSocket connected');
      };
      
      ws.onmessage = (event) => {
        try {
          const data = JSON.parse(event.data);
          if (data.type === 'log') {
            setLogs(prev => [...prev, data.message]);
          } else if (data.type === 'status') {
            console.log('Container status:', data.status);
          }
        } catch (error) {
          // Handle plain text logs
          setLogs(prev => [...prev, event.data]);
        }
      };
      
      ws.onclose = () => {
        setIsConnected(false);
        console.log('WebSocket disconnected');
        // Attempt to reconnect after 3 seconds
        setTimeout(() => {
          if (wsRef.current?.readyState === WebSocket.CLOSED) {
            connectWebSocket();
          }
        }, 3000);
      };
      
      ws.onerror = (error) => {
        console.error('WebSocket error:', error);
        setIsConnected(false);
      };
      
      wsRef.current = ws;
    } catch (error) {
      console.error('Failed to connect WebSocket:', error);
    }
  };

  const handleStart = async () => {
    try {
      setIsLoading(true);
      await startContainer(containerId);
      toast({
        title: "Container dimulai",
        description: "Container berhasil dijalankan",
      });
    } catch (error) {
      console.error('Failed to start container:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const handleRestart = async () => {
    try {
      setIsLoading(true);
      await restartContainer(containerId);
      toast({
        title: "Container direstart",
        description: "Container berhasil direstart",
      });
    } catch (error) {
      console.error('Failed to restart container:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const handleStop = async () => {
    try {
      setIsLoading(true);
      await stopContainer(containerId);
      toast({
        title: "Container dihentikan",
        description: "Container berhasil dihentikan",
      });
    } catch (error) {
      console.error('Failed to stop container:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const handleDownloadLogs = async () => {
    try {
      const blob = await apiService.downloadContainerLogs(containerId);
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `${containerName}-logs.txt`;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);
      
      toast({
        title: "Log berhasil diunduh",
        description: "File log telah disimpan",
      });
    } catch (error) {
      console.error('Failed to download logs:', error);
      toast({
        title: "Gagal mengunduh log",
        description: error instanceof Error ? error.message : "Terjadi kesalahan",
        variant: "destructive",
      });
    }
  };

  const handleClearLogs = async () => {
    try {
      await apiService.clearContainerLogs(containerId);
      setLogs([]);
      toast({
        title: "Log berhasil dihapus",
        description: "Semua log telah dihapus",
      });
    } catch (error) {
      console.error('Failed to clear logs:', error);
      toast({
        title: "Gagal menghapus log",
        description: error instanceof Error ? error.message : "Terjadi kesalahan",
        variant: "destructive",
      });
    }
  };

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
          <div>
            <h1 className="text-4xl font-bold text-golden">Console Log Script</h1>
            <p className="text-muted-foreground mt-1">
              {containerName} {isConnected ? (
                <span className="text-green-500">• Connected</span>
              ) : (
                <span className="text-red-500">• Disconnected</span>
              )}
            </p>
          </div>
        </div>
        <Button 
          onClick={logout}
          className="bg-primary hover:bg-primary/90 text-primary-foreground rounded-2xl px-6"
        >
          <LogOut className="w-4 h-4 mr-2" />
          LOG OUT
        </Button>
      </header>

      <div className="flex flex-col lg:flex-row gap-6">
        {/* Terminal Window */}
        <div className="flex-1">
          <Card className="bg-terminal border-border rounded-2xl overflow-hidden">
            {/* Terminal Header */}
            <div className="bg-muted/30 p-4 border-b border-border">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <div className="w-3 h-3 rounded-full bg-red-500"></div>
                  <div className="w-3 h-3 rounded-full bg-yellow-500"></div>
                  <div className="w-3 h-3 rounded-full bg-green-500"></div>
                  <span className="ml-4 text-foreground font-medium">{containerName}</span>
                </div>
                <div className="flex items-center gap-2">
                  <Button
                    onClick={handleDownloadLogs}
                    variant="ghost"
                    size="sm"
                    className="text-foreground hover:bg-muted"
                  >
                    <Download className="w-4 h-4" />
                  </Button>
                  <Button
                    onClick={handleClearLogs}
                    variant="ghost"
                    size="sm"
                    className="text-foreground hover:bg-muted"
                  >
                    <Trash2 className="w-4 h-4" />
                  </Button>
                </div>
              </div>
            </div>
            
            {/* Terminal Content */}
            <div 
              ref={terminalRef}
              className="p-4 h-96 overflow-y-auto font-mono text-sm bg-black/50"
            >
              {logs.map((log, index) => (
                <div key={index} className="text-green-400 mb-1 whitespace-pre-wrap">
                  {log}
                </div>
              ))}
              {logs.length === 0 && (
                <div className="text-muted-foreground">
                  Waiting for script output...
                </div>
              )}
            </div>
          </Card>
        </div>

        {/* Control Buttons */}
        <div className="lg:w-80 space-y-4">
          <Button 
            onClick={handleStart}
            disabled={isLoading}
            className="w-full h-14 bg-green-600 hover:bg-green-700 text-white rounded-2xl text-lg font-medium"
          >
            <Play className="w-5 h-5 mr-2" />
            START
          </Button>
          
          <Button 
            onClick={handleRestart}
            disabled={isLoading}
            className="w-full h-14 bg-orange-600 hover:bg-orange-700 text-white rounded-2xl text-lg font-medium"
          >
            <RotateCcw className="w-5 h-5 mr-2" />
            RESTART
          </Button>
          
          <Button 
            onClick={handleStop}
            disabled={isLoading}
            className="w-full h-14 bg-red-600 hover:bg-red-700 text-white rounded-2xl text-lg font-medium"
          >
            <Square className="w-5 h-5 mr-2" />
            STOP
          </Button>
        </div>
      </div>
    </div>
  );
};

export default ConsoleLogScript;
