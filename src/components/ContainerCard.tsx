import { Card } from "@/components/ui/card";

interface Container {
  id: string;
  name: string;
  status: "Running" | "Stop";
  folder: string;
}

interface ContainerCardProps {
  container: Container;
  onClick: () => void;
}

const ContainerCard = ({ container, onClick }: ContainerCardProps) => {
  const isRunning = container.status === "Running";
  
  return (
    <Card 
      className="bg-container border-border hover:bg-container/90 transition-all duration-200 cursor-pointer p-6 rounded-2xl min-h-[200px] shadow-lg hover:shadow-xl"
      onClick={onClick}
      style={{ boxShadow: 'var(--card-glow)' }}
    >
      <div className="flex flex-col h-full">
        <h3 className="text-golden font-bold text-xl mb-4">{container.name}</h3>
        
        <div className="space-y-3 flex-1">
          <div className="flex items-center gap-2">
            <span className="text-golden font-medium">Status:</span>
            <span className={`font-medium ${
              isRunning ? 'text-container-running' : 'text-container-stopped'
            }`}>
              {container.status}
            </span>
          </div>
          
          <div>
            <span className="text-golden font-medium">ID:</span>
            <span className="text-container-foreground ml-2 font-mono text-sm">
              {container.id}
            </span>
          </div>
          
          <div>
            <span className="text-golden font-medium">Folder:</span>
            <span className="text-container-foreground ml-2 font-mono text-sm">
              {container.folder}
            </span>
          </div>
        </div>
      </div>
    </Card>
  );
};

export default ContainerCard;