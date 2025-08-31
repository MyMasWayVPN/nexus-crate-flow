import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card } from "@/components/ui/card";
import { Switch } from "@/components/ui/switch";
import { Menu, LogOut, Square, RotateCcw, Trash2 } from "lucide-react";

interface SettingsContainerProps {
  containerName: string;
  startupScript: string;
  cloudflaredToken: string;
  tunnelEnabled: boolean;
  logs: string[];
  onLogout: () => void;
  onBack: () => void;
  onUpdateScript: (script: string) => void;
  onUpdateToken: (token: string) => void;
  onToggleTunnel: (enabled: boolean) => void;
  onStopContainer: () => void;
  onRestartContainer: () => void;
  onDeleteContainer: () => void;
}

const SettingsContainer = ({
  containerName,
  startupScript,
  cloudflaredToken,
  tunnelEnabled,
  logs,
  onLogout,
  onBack,
  onUpdateScript,
  onUpdateToken,
  onToggleTunnel,
  onStopContainer,
  onRestartContainer,
  onDeleteContainer
}: SettingsContainerProps) => {
  const [script, setScript] = useState(startupScript);
  const [token, setToken] = useState(cloudflaredToken);

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
          <h1 className="text-4xl font-bold text-golden">Settings Kontainer</h1>
        </div>
        <Button 
          onClick={onLogout}
          className="bg-primary hover:bg-primary/90 text-primary-foreground rounded-2xl px-6"
        >
          <LogOut className="w-4 h-4 mr-2" />
          LOG OUT
        </Button>
      </header>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        {/* Left Panel - Settings */}
        <div className="space-y-6">
          {/* Startup Script */}
          <div>
            <h2 className="text-golden font-bold text-xl mb-4">Startup Script</h2>
            <Card className="bg-container border-border p-4 rounded-2xl">
              <div className="mb-2">
                <span className="text-container-foreground font-medium">Contoh : node start.js</span>
              </div>
              <Input
                value={script}
                onChange={(e) => {
                  setScript(e.target.value);
                  onUpdateScript(e.target.value);
                }}
                className="bg-background border-border text-foreground"
                placeholder="node start.js"
              />
            </Card>
          </div>

          {/* Cloudflared Tunnel */}
          <div>
            <h2 className="text-golden font-bold text-xl mb-4">Cloudflared Tunnel</h2>
            <div className="space-y-4">
              <div className="flex items-center gap-4">
                <Switch 
                  checked={tunnelEnabled}
                  onCheckedChange={onToggleTunnel}
                  className="data-[state=checked]:bg-primary"
                />
                <span className={`px-4 py-2 rounded-full text-sm font-medium ${
                  tunnelEnabled ? 'bg-primary text-primary-foreground' : 'bg-actions-red text-white'
                }`}>
                  {tunnelEnabled ? 'ON' : 'OFF'}
                </span>
              </div>
              
              <div>
                <span className="text-golden font-medium block mb-2">Cloudflared Token :</span>
                <Card className="bg-container border-border p-4 rounded-2xl">
                  <div className="mb-2">
                    <span className="text-container-foreground font-medium">Contoh : eywuygdbffji</span>
                  </div>
                  <Input
                    value={token}
                    onChange={(e) => {
                      setToken(e.target.value);
                      onUpdateToken(e.target.value);
                    }}
                    className="bg-background border-border text-foreground"
                    placeholder="eywuygdbffji"
                  />
                </Card>
              </div>
            </div>
          </div>

          {/* Actions Container */}
          <div>
            <h2 className="text-golden font-bold text-xl mb-4">Actions Container</h2>
            <div className="space-y-3">
              <Button 
                onClick={onStopContainer}
                className="w-full h-12 bg-actions-gray hover:bg-actions-gray/90 text-white rounded-2xl"
              >
                <Square className="w-4 h-4 mr-2" />
                Stop
              </Button>
              
              <Button 
                onClick={onRestartContainer}
                className="w-full h-12 bg-actions-red hover:bg-actions-red/90 text-white rounded-2xl"
              >
                <RotateCcw className="w-4 h-4 mr-2" />
                RESTART
              </Button>
              
              <Button 
                onClick={onDeleteContainer}
                className="w-full h-12 bg-destructive hover:bg-destructive/90 text-destructive-foreground rounded-2xl"
              >
                <Trash2 className="w-4 h-4 mr-2" />
                DELETE
              </Button>
            </div>
          </div>
        </div>

        {/* Right Panel - Log Tunnels */}
        <div>
          <h2 className="text-golden font-bold text-xl mb-4">Log Tunnels</h2>
          <Card className="bg-terminal border-border rounded-2xl overflow-hidden h-96">
            {/* Terminal Header */}
            <div className="bg-muted/30 p-4 border-b border-border">
              <div className="flex items-center gap-2">
                <div className="w-3 h-3 rounded-full bg-red-500"></div>
                <div className="w-3 h-3 rounded-full bg-yellow-500"></div>
                <div className="w-3 h-3 rounded-full bg-green-500"></div>
                <span className="ml-4 text-foreground font-medium">Log Tunnels</span>
              </div>
            </div>
            
            {/* Terminal Content */}
            <div className="p-4 h-full overflow-y-auto font-mono text-sm">
              {logs.map((log, index) => (
                <div key={index} className="text-foreground mb-1">
                  {log}
                </div>
              ))}
              {logs.length === 0 && (
                <div className="text-muted-foreground">
                  No tunnel logs available...
                </div>
              )}
            </div>
          </Card>
        </div>
      </div>
    </div>
  );
};

export default SettingsContainer;