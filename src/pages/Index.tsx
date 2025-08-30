import { useState } from "react";
import LoginPage from "@/components/LoginPage";
import DashboardContainer from "@/components/DashboardContainer";
import ConsoleLogScript from "@/components/ConsoleLogScript";
import FileManager from "@/components/FileManager";
import SettingsContainer from "@/components/SettingsContainer";
import { useToast } from "@/hooks/use-toast";

interface Container {
  id: string;
  name: string;
  status: "Running" | "Stop";
  folder: string;
}

type ViewType = "login" | "dashboard" | "console" | "files" | "settings";

const Index = () => {
  const [currentView, setCurrentView] = useState<ViewType>("login");
  const [selectedContainer, setSelectedContainer] = useState<Container | null>(null);
  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const { toast } = useToast();

  // Sample data
  const [containers] = useState<Container[]>([
    { id: "werfyiu4erfd", name: "Nama Container", status: "Running", folder: "/home/data/werfyiu4erfd" },
    { id: "yuh3rd6y6", name: "Nama Container", status: "Running", folder: "/home/data/yuh3rd6y6" },
    { id: "werfegverytg", name: "Nama Container", status: "Running", folder: "/home/data/werfegverytg" },
    { id: "sfergrth", name: "Nama Container", status: "Stop", folder: "/home/data/sfergrth" },
    { id: "grtgt4Gref", name: "Nama Container", status: "Running", folder: "/home/data/grtgt4Gref" },
    { id: "ert5erfferrt", name: "Nama Container", status: "Running", folder: "/home/data/ert5erfferrt" },
    { id: "erte5d4rtfg", name: "Nama Container", status: "Running", folder: "/home/data/erte5d4rtfg" },
  ]);

  const [consoleLogs] = useState<string[]>([
    "Starting application...",
    "Server listening on port 3000",
    "Database connected successfully",
    "Application ready"
  ]);

  const [files] = useState([
    { name: "app.js", type: "file" as const, size: "12.5KB", date: "12-09-20025" },
    { name: "config", type: "folder" as const, size: "-", date: "12-09-20025" },
    { name: "package.json", type: "file" as const, size: "2.1KB", date: "12-09-20025" },
    { name: "node_modules", type: "folder" as const, size: "-", date: "12-09-20025" },
    { name: "start.js", type: "file" as const, size: "1.8KB", date: "12-09-20025" },
  ]);

  const handleLogin = (username: string, password: string) => {
    // Simple demo authentication
    if (username && password) {
      setIsLoggedIn(true);
      setCurrentView("dashboard");
      toast({
        title: "Login berhasil",
        description: "Selamat datang di Container Management System",
      });
    } else {
      toast({
        title: "Login gagal",
        description: "Username atau password salah",
        variant: "destructive",
      });
    }
  };

  const handleLogout = () => {
    setIsLoggedIn(false);
    setCurrentView("login");
    setSelectedContainer(null);
    toast({
      title: "Logout berhasil",
      description: "Anda telah keluar dari sistem",
    });
  };

  const handleSelectContainer = (container: Container) => {
    setSelectedContainer(container);
    setCurrentView("console");
  };

  const handleCreateContainer = () => {
    toast({
      title: "Fitur dalam pengembangan",
      description: "Fitur membuat container akan segera tersedia",
    });
  };

  const renderCurrentView = () => {
    switch (currentView) {
      case "login":
        return <LoginPage onLogin={handleLogin} />;
      
      case "dashboard":
        return (
          <DashboardContainer
            containers={containers}
            onCreateContainer={handleCreateContainer}
            onLogout={handleLogout}
            onSelectContainer={handleSelectContainer}
          />
        );
      
      case "console":
        return selectedContainer ? (
          <ConsoleLogScript
            containerName={selectedContainer.name}
            logs={consoleLogs}
            onStart={() => toast({ title: "Script started" })}
            onRestart={() => toast({ title: "Script restarted" })}
            onStop={() => toast({ title: "Script stopped" })}
            onLogout={handleLogout}
            onBack={() => setCurrentView("dashboard")}
          />
        ) : null;
      
      case "files":
        return selectedContainer ? (
          <FileManager
            containerName={selectedContainer.name}
            currentPath={selectedContainer.folder}
            files={files}
            onLogout={handleLogout}
            onBack={() => setCurrentView("dashboard")}
            onNavigate={(path) => toast({ title: `Navigating to ${path}` })}
          />
        ) : null;
      
      case "settings":
        return selectedContainer ? (
          <SettingsContainer
            containerName={selectedContainer.name}
            startupScript="node start.js"
            cloudflaredToken="eywuygdbffji"
            tunnelEnabled={false}
            logs={[]}
            onLogout={handleLogout}
            onBack={() => setCurrentView("dashboard")}
            onUpdateScript={() => toast({ title: "Script updated" })}
            onUpdateToken={() => toast({ title: "Token updated" })}
            onToggleTunnel={() => toast({ title: "Tunnel toggled" })}
            onStopContainer={() => toast({ title: "Container stopped" })}
            onRestartContainer={() => toast({ title: "Container restarted" })}
            onDeleteContainer={() => toast({ title: "Container deleted", variant: "destructive" })}
          />
        ) : null;
      
      default:
        return null;
    }
  };

  return (
    <div>
      {renderCurrentView()}
      
      {/* Navigation hint for demo */}
      {isLoggedIn && selectedContainer && (
        <div className="fixed bottom-4 right-4 space-y-2">
          <button
            onClick={() => setCurrentView("console")}
            className="block w-full bg-primary text-primary-foreground px-4 py-2 rounded-lg text-sm"
          >
            Console
          </button>
          <button
            onClick={() => setCurrentView("files")}
            className="block w-full bg-golden text-golden-foreground px-4 py-2 rounded-lg text-sm"
          >
            Files
          </button>
          <button
            onClick={() => setCurrentView("settings")}
            className="block w-full bg-container text-container-foreground px-4 py-2 rounded-lg text-sm"
          >
            Settings
          </button>
        </div>
      )}
    </div>
  );
};

export default Index;
