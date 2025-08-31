import { useState, useEffect } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { useContainer } from "@/contexts/ContainerContext";
import LoginPage from "@/components/LoginPage";
import DashboardContainer from "@/components/DashboardContainer";
import ConsoleLogScript from "@/components/ConsoleLogScript";
import FileManager from "@/components/FileManager";
import SettingsContainer from "@/components/SettingsContainer";
import { Button } from "@/components/ui/button";
import { Loader2 } from "lucide-react";

type ViewType = "dashboard" | "console" | "files" | "settings";

const Index = () => {
  const [currentView, setCurrentView] = useState<ViewType>("dashboard");
  const { isAuthenticated, isLoading: authLoading } = useAuth();
  const { selectedContainer, selectContainer } = useContainer();

  // Reset view when authentication changes
  useEffect(() => {
    if (!isAuthenticated) {
      setCurrentView("dashboard");
      selectContainer(null);
    }
  }, [isAuthenticated, selectContainer]);

  const handleSelectContainer = (container: any) => {
    selectContainer(container);
    setCurrentView("console");
  };

  const handleBackToDashboard = () => {
    setCurrentView("dashboard");
  };

  // Show loading screen while checking authentication
  if (authLoading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="text-center">
          <Loader2 className="w-8 h-8 animate-spin text-golden mx-auto mb-4" />
          <p className="text-muted-foreground">Memuat aplikasi...</p>
        </div>
      </div>
    );
  }

  // Show login page if not authenticated
  if (!isAuthenticated) {
    return <LoginPage />;
  }

  const renderCurrentView = () => {
    switch (currentView) {
      case "dashboard":
        return (
          <DashboardContainer
            onSelectContainer={handleSelectContainer}
          />
        );
      
      case "console":
        return selectedContainer ? (
          <ConsoleLogScript
            containerName={selectedContainer.name}
            containerId={selectedContainer.id}
            onBack={handleBackToDashboard}
          />
        ) : null;
      
      case "files":
        return selectedContainer ? (
          <FileManager
            containerName={selectedContainer.name}
            containerId={selectedContainer.id}
            currentPath={selectedContainer.folder}
            onBack={handleBackToDashboard}
          />
        ) : null;
      
      case "settings":
        return selectedContainer ? (
          <SettingsContainer
            containerName={selectedContainer.name}
            containerId={selectedContainer.id}
            onBack={handleBackToDashboard}
          />
        ) : null;
      
      default:
        return null;
    }
  };

  return (
    <div>
      {renderCurrentView()}
      
      {/* Navigation buttons when container is selected */}
      {selectedContainer && (
        <div className="fixed bottom-4 right-4 space-y-2 z-50">
          <Button
            onClick={() => setCurrentView("console")}
            variant={currentView === "console" ? "default" : "secondary"}
            className="block w-full rounded-lg text-sm"
          >
            Console
          </Button>
          <Button
            onClick={() => setCurrentView("files")}
            variant={currentView === "files" ? "default" : "secondary"}
            className="block w-full rounded-lg text-sm"
          >
            Files
          </Button>
          <Button
            onClick={() => setCurrentView("settings")}
            variant={currentView === "settings" ? "default" : "secondary"}
            className="block w-full rounded-lg text-sm"
          >
            Settings
          </Button>
          <Button
            onClick={handleBackToDashboard}
            variant="outline"
            className="block w-full rounded-lg text-sm"
          >
            Dashboard
          </Button>
        </div>
      )}
    </div>
  );
};

export default Index;
