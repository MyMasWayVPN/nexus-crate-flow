import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Plus, LogOut, RefreshCw, Loader2 } from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import { useContainer } from "@/contexts/ContainerContext";
import ContainerCard from "./ContainerCard";

interface DashboardContainerProps {
  onSelectContainer: (container: any) => void;
}

const DashboardContainer = ({ onSelectContainer }: DashboardContainerProps) => {
  const { user, logout } = useAuth();
  const { containers, isLoading, refreshContainers, createContainer } = useContainer();

  const handleCreateContainer = async () => {
    try {
      // For now, create a simple container with default settings
      // In a real app, this would open a modal or form
      const containerData = {
        name: `container-${Date.now()}`,
        image: 'node:18-alpine',
        startup_script: 'npm start',
        environment: [],
        ports: {},
        memory: '512m',
        cpu: '1'
      };
      
      await createContainer(containerData);
    } catch (error) {
      console.error('Failed to create container:', error);
    }
  };

  const handleRefresh = async () => {
    await refreshContainers();
  };

  return (
    <div className="min-h-screen bg-background p-6">
      <header className="flex justify-between items-center mb-8">
        <div>
          <h1 className="text-4xl font-bold text-golden">Dashboard Container</h1>
          {user && (
            <p className="text-muted-foreground mt-2">
              Selamat datang, {user.username}
            </p>
          )}
        </div>
        <div className="flex items-center gap-4">
          <Button 
            onClick={handleRefresh}
            disabled={isLoading}
            variant="outline"
            className="rounded-2xl px-6"
          >
            {isLoading ? (
              <Loader2 className="w-4 h-4 mr-2 animate-spin" />
            ) : (
              <RefreshCw className="w-4 h-4 mr-2" />
            )}
            Refresh
          </Button>
          <Button 
            onClick={logout}
            className="bg-primary hover:bg-primary/90 text-primary-foreground rounded-2xl px-6"
          >
            <LogOut className="w-4 h-4 mr-2" />
            LOG OUT
          </Button>
        </div>
      </header>

      <p className="text-muted-foreground text-lg mb-8">
        Pilih Kontainer Untuk Mengelolanya ({containers.length} container)
      </p>

      {isLoading && containers.length === 0 ? (
        <div className="flex items-center justify-center py-12">
          <Loader2 className="w-8 h-8 animate-spin text-golden" />
          <span className="ml-2 text-muted-foreground">Memuat container...</span>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
          {containers.map((container) => (
            <ContainerCard
              key={container.id}
              container={container}
              onClick={() => onSelectContainer(container)}
            />
          ))}
          
          {/* Create Container Card */}
          <Card 
            className="bg-muted border-border hover:bg-muted/80 transition-colors cursor-pointer p-6 rounded-2xl flex flex-col items-center justify-center min-h-[200px]"
            onClick={handleCreateContainer}
          >
            <Plus className="w-12 h-12 text-golden mb-4" />
            <span className="text-golden font-medium text-lg">Buat Container</span>
          </Card>
        </div>
      )}

      {!isLoading && containers.length === 0 && (
        <div className="text-center py-12">
          <div className="text-muted-foreground mb-4">
            <Plus className="w-16 h-16 mx-auto mb-4 opacity-50" />
            <p className="text-lg">Belum ada container</p>
            <p className="text-sm">Klik "Buat Container" untuk memulai</p>
          </div>
        </div>
      )}
    </div>
  );
};

export default DashboardContainer;
