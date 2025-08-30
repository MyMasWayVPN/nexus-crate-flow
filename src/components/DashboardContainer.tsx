import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Plus, LogOut } from "lucide-react";
import ContainerCard from "./ContainerCard";

interface Container {
  id: string;
  name: string;
  status: "Running" | "Stop";
  folder: string;
}

interface DashboardContainerProps {
  containers: Container[];
  onCreateContainer: () => void;
  onLogout: () => void;
  onSelectContainer: (container: Container) => void;
}

const DashboardContainer = ({ 
  containers, 
  onCreateContainer, 
  onLogout, 
  onSelectContainer 
}: DashboardContainerProps) => {
  return (
    <div className="min-h-screen bg-background p-6">
      <header className="flex justify-between items-center mb-8">
        <h1 className="text-4xl font-bold text-golden">Dashboard Container</h1>
        <Button 
          onClick={onLogout}
          className="bg-primary hover:bg-primary/90 text-primary-foreground rounded-2xl px-6"
        >
          <LogOut className="w-4 h-4 mr-2" />
          LOG OUT
        </Button>
      </header>

      <p className="text-muted-foreground text-lg mb-8">
        Pilih Kontainer Untuk Mengelolanya
      </p>

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
          onClick={onCreateContainer}
        >
          <Plus className="w-12 h-12 text-golden mb-4" />
          <span className="text-golden font-medium text-lg">Buat Container</span>
        </Card>
      </div>
    </div>
  );
};

export default DashboardContainer;