import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Menu, LogOut, Play, RotateCcw, Square } from "lucide-react";

interface ConsoleLogScriptProps {
  containerName: string;
  logs: string[];
  onStart: () => void;
  onRestart: () => void;
  onStop: () => void;
  onLogout: () => void;
  onBack: () => void;
}

const ConsoleLogScript = ({
  containerName,
  logs,
  onStart,
  onRestart,
  onStop,
  onLogout,
  onBack
}: ConsoleLogScriptProps) => {
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
          <h1 className="text-4xl font-bold text-golden">Console Log Script</h1>
        </div>
        <Button 
          onClick={onLogout}
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
              <div className="flex items-center gap-2">
                <div className="w-3 h-3 rounded-full bg-red-500"></div>
                <div className="w-3 h-3 rounded-full bg-yellow-500"></div>
                <div className="w-3 h-3 rounded-full bg-green-500"></div>
                <span className="ml-4 text-foreground font-medium">{containerName}</span>
              </div>
            </div>
            
            {/* Terminal Content */}
            <div className="p-4 h-96 overflow-y-auto font-mono text-sm">
              {logs.map((log, index) => (
                <div key={index} className="text-foreground mb-1">
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
            onClick={onStart}
            className="w-full h-14 bg-actions-orange hover:bg-actions-orange/90 text-white rounded-2xl text-lg font-medium"
          >
            <Play className="w-5 h-5 mr-2" />
            START
          </Button>
          
          <Button 
            onClick={onRestart}
            className="w-full h-14 bg-actions-red hover:bg-actions-red/90 text-white rounded-2xl text-lg font-medium"
          >
            <RotateCcw className="w-5 h-5 mr-2" />
            RESTART
          </Button>
          
          <Button 
            onClick={onStop}
            className="w-full h-14 bg-actions-gray hover:bg-actions-gray/90 text-white rounded-2xl text-lg font-medium"
          >
            <Square className="w-5 h-5 mr-2" />
            Stop
          </Button>
        </div>
      </div>
    </div>
  );
};

export default ConsoleLogScript;