import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { apiService } from '@/services/api';
import { useToast } from '@/hooks/use-toast';
import { useAuth } from './AuthContext';

interface Container {
  id: string;
  name: string;
  status: "Running" | "Stop" | "Stopped" | "Created" | "Exited";
  folder: string;
  docker_id?: string;
  image?: string;
  created_at: string;
  updated_at: string;
}

interface ContainerContextType {
  containers: Container[];
  selectedContainer: Container | null;
  isLoading: boolean;
  refreshContainers: () => Promise<void>;
  selectContainer: (container: Container) => void;
  createContainer: (data: any) => Promise<Container>;
  updateContainer: (id: string, data: any) => Promise<Container>;
  deleteContainer: (id: string) => Promise<void>;
  startContainer: (id: string) => Promise<void>;
  stopContainer: (id: string) => Promise<void>;
  restartContainer: (id: string) => Promise<void>;
}

const ContainerContext = createContext<ContainerContextType | undefined>(undefined);

interface ContainerProviderProps {
  children: ReactNode;
}

export const ContainerProvider: React.FC<ContainerProviderProps> = ({ children }) => {
  const [containers, setContainers] = useState<Container[]>([]);
  const [selectedContainer, setSelectedContainer] = useState<Container | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const { toast } = useToast();
  const { isAuthenticated } = useAuth();

  // Load containers when authenticated
  useEffect(() => {
    if (isAuthenticated) {
      refreshContainers();
    } else {
      setContainers([]);
      setSelectedContainer(null);
    }
  }, [isAuthenticated]);

  const refreshContainers = async () => {
    if (!isAuthenticated) return;
    
    try {
      setIsLoading(true);
      const containerData = await apiService.getContainers();
      setContainers(containerData);
      
      // Update selected container if it exists
      if (selectedContainer) {
        const updatedSelected = containerData.find(c => c.id === selectedContainer.id);
        if (updatedSelected) {
          setSelectedContainer(updatedSelected);
        } else {
          setSelectedContainer(null);
        }
      }
    } catch (error) {
      console.error('Failed to refresh containers:', error);
      toast({
        title: "Gagal memuat container",
        description: error instanceof Error ? error.message : "Terjadi kesalahan saat memuat data container",
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };

  const selectContainer = (container: Container) => {
    setSelectedContainer(container);
  };

  const createContainer = async (data: any): Promise<Container> => {
    try {
      setIsLoading(true);
      const newContainer = await apiService.createContainer(data);
      
      // Refresh containers to get updated list
      await refreshContainers();
      
      toast({
        title: "Container berhasil dibuat",
        description: `Container "${newContainer.name}" telah dibuat`,
      });
      
      return newContainer;
    } catch (error) {
      console.error('Failed to create container:', error);
      toast({
        title: "Gagal membuat container",
        description: error instanceof Error ? error.message : "Terjadi kesalahan saat membuat container",
        variant: "destructive",
      });
      throw error;
    } finally {
      setIsLoading(false);
    }
  };

  const updateContainer = async (id: string, data: any): Promise<Container> => {
    try {
      setIsLoading(true);
      const updatedContainer = await apiService.updateContainer(id, data);
      
      // Update containers list
      setContainers(prev => prev.map(c => c.id === id ? updatedContainer : c));
      
      // Update selected container if it's the one being updated
      if (selectedContainer?.id === id) {
        setSelectedContainer(updatedContainer);
      }
      
      toast({
        title: "Container berhasil diperbarui",
        description: `Container "${updatedContainer.name}" telah diperbarui`,
      });
      
      return updatedContainer;
    } catch (error) {
      console.error('Failed to update container:', error);
      toast({
        title: "Gagal memperbarui container",
        description: error instanceof Error ? error.message : "Terjadi kesalahan saat memperbarui container",
        variant: "destructive",
      });
      throw error;
    } finally {
      setIsLoading(false);
    }
  };

  const deleteContainer = async (id: string): Promise<void> => {
    try {
      setIsLoading(true);
      await apiService.deleteContainer(id);
      
      // Remove from containers list
      setContainers(prev => prev.filter(c => c.id !== id));
      
      // Clear selected container if it's the one being deleted
      if (selectedContainer?.id === id) {
        setSelectedContainer(null);
      }
      
      toast({
        title: "Container berhasil dihapus",
        description: "Container telah dihapus dari sistem",
      });
    } catch (error) {
      console.error('Failed to delete container:', error);
      toast({
        title: "Gagal menghapus container",
        description: error instanceof Error ? error.message : "Terjadi kesalahan saat menghapus container",
        variant: "destructive",
      });
      throw error;
    } finally {
      setIsLoading(false);
    }
  };

  const startContainer = async (id: string): Promise<void> => {
    try {
      await apiService.startContainer(id);
      
      // Update container status
      setContainers(prev => prev.map(c => 
        c.id === id ? { ...c, status: "Running" as const } : c
      ));
      
      // Update selected container if it's the one being started
      if (selectedContainer?.id === id) {
        setSelectedContainer(prev => prev ? { ...prev, status: "Running" } : null);
      }
      
      toast({
        title: "Container dimulai",
        description: "Container berhasil dijalankan",
      });
    } catch (error) {
      console.error('Failed to start container:', error);
      toast({
        title: "Gagal menjalankan container",
        description: error instanceof Error ? error.message : "Terjadi kesalahan saat menjalankan container",
        variant: "destructive",
      });
      throw error;
    }
  };

  const stopContainer = async (id: string): Promise<void> => {
    try {
      await apiService.stopContainer(id);
      
      // Update container status
      setContainers(prev => prev.map(c => 
        c.id === id ? { ...c, status: "Stop" as const } : c
      ));
      
      // Update selected container if it's the one being stopped
      if (selectedContainer?.id === id) {
        setSelectedContainer(prev => prev ? { ...prev, status: "Stop" } : null);
      }
      
      toast({
        title: "Container dihentikan",
        description: "Container berhasil dihentikan",
      });
    } catch (error) {
      console.error('Failed to stop container:', error);
      toast({
        title: "Gagal menghentikan container",
        description: error instanceof Error ? error.message : "Terjadi kesalahan saat menghentikan container",
        variant: "destructive",
      });
      throw error;
    }
  };

  const restartContainer = async (id: string): Promise<void> => {
    try {
      await apiService.restartContainer(id);
      
      // Update container status
      setContainers(prev => prev.map(c => 
        c.id === id ? { ...c, status: "Running" as const } : c
      ));
      
      // Update selected container if it's the one being restarted
      if (selectedContainer?.id === id) {
        setSelectedContainer(prev => prev ? { ...prev, status: "Running" } : null);
      }
      
      toast({
        title: "Container direstart",
        description: "Container berhasil direstart",
      });
    } catch (error) {
      console.error('Failed to restart container:', error);
      toast({
        title: "Gagal merestart container",
        description: error instanceof Error ? error.message : "Terjadi kesalahan saat merestart container",
        variant: "destructive",
      });
      throw error;
    }
  };

  const value: ContainerContextType = {
    containers,
    selectedContainer,
    isLoading,
    refreshContainers,
    selectContainer,
    createContainer,
    updateContainer,
    deleteContainer,
    startContainer,
    stopContainer,
    restartContainer,
  };

  return (
    <ContainerContext.Provider value={value}>
      {children}
    </ContainerContext.Provider>
  );
};

export const useContainer = () => {
  const context = useContext(ContainerContext);
  if (context === undefined) {
    throw new Error('useContainer must be used within a ContainerProvider');
  }
  return context;
};

export default ContainerContext;
