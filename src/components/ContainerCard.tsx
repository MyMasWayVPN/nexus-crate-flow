import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Play, Square, Clock, AlertCircle } from "lucide-react";

interface Container {
  id: string;
  name: string;
  status: "Running" | "Stop" | "Stopped" | "Created" | "Exited";
  folder: string;
  docker_id?: string;
  image?: string;
  created_at?: string;
}

interface ContainerCardProps {
  container: Container;
  onClick: () => void;
}

const ContainerCard = ({ container, onClick }: ContainerCardProps) => {
  const getStatusInfo = (status: string) => {
    switch (status) {
      case "Running":
        return {
          color: "text-green-500",
          bgColor: "bg-green-500/10",
          icon: <Play className="w-3 h-3" />,
          label: "Running"
        };
      case "Stop":
      case "Stopped":
        return {
          color: "text-red-500",
          bgColor: "bg-red-500/10",
          icon: <Square className="w-3 h-3" />,
          label: "Stopped"
        };
      case "Created":
        return {
          color: "text-blue-500",
          bgColor: "bg-blue-500/10",
          icon: <Clock className="w-3 h-3" />,
          label: "Created"
        };
      case "Exited":
        return {
          color: "text-orange-500",
          bgColor: "bg-orange-500/10",
          icon: <AlertCircle className="w-3 h-3" />,
          label: "Exited"
        };
      default:
        return {
          color: "text-gray-500",
          bgColor: "bg-gray-500/10",
          icon: <AlertCircle className="w-3 h-3" />,
          label: status
        };
    }
  };

  const statusInfo = getStatusInfo(container.status);
  
  return (
    <Card 
      className="bg-container border-border hover:bg-container/90 transition-all duration-200 cursor-pointer p-6 rounded-2xl min-h-[200px] shadow-lg hover:shadow-xl"
      onClick={onClick}
      style={{ boxShadow: 'var(--card-glow)' }}
    >
      <div className="flex flex-col h-full">
        <div className="flex items-start justify-between mb-4">
          <h3 className="text-golden font-bold text-xl truncate flex-1">
            {container.name}
          </h3>
          <Badge 
            variant="secondary" 
            className={`${statusInfo.color} ${statusInfo.bgColor} border-0 ml-2`}
          >
            {statusInfo.icon}
            <span className="ml-1">{statusInfo.label}</span>
          </Badge>
        </div>
        
        <div className="space-y-3 flex-1">
          <div>
            <span className="text-golden font-medium text-sm">ID:</span>
            <span className="text-container-foreground ml-2 font-mono text-xs">
              {container.id.substring(0, 12)}...
            </span>
          </div>
          
          {container.image && (
            <div>
              <span className="text-golden font-medium text-sm">Image:</span>
              <span className="text-container-foreground ml-2 text-xs">
                {container.image}
              </span>
            </div>
          )}
          
          <div>
            <span className="text-golden font-medium text-sm">Folder:</span>
            <span className="text-container-foreground ml-2 font-mono text-xs truncate block">
              {container.folder}
            </span>
          </div>
          
          {container.created_at && (
            <div>
              <span className="text-golden font-medium text-sm">Created:</span>
              <span className="text-container-foreground ml-2 text-xs">
                {new Date(container.created_at).toLocaleDateString('id-ID')}
              </span>
            </div>
          )}
        </div>
      </div>
    </Card>
  );
};

export default ContainerCard;
