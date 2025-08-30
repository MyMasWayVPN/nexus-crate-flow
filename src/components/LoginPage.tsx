import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { User } from "lucide-react";

interface LoginPageProps {
  onLogin: (username: string, password: string) => void;
}

const LoginPage = ({ onLogin }: LoginPageProps) => {
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onLogin(username, password);
  };

  return (
    <div className="min-h-screen bg-background flex items-center justify-center p-4">
      <div className="w-full max-w-md space-y-8">
        <div className="text-center">
          <Avatar className="mx-auto w-24 h-24 mb-6 border-4 border-primary">
            <AvatarFallback className="bg-primary text-primary-foreground">
              <User className="w-10 h-10" />
            </AvatarFallback>
          </Avatar>
        </div>
        
        <form onSubmit={handleSubmit} className="space-y-6">
          <div>
            <Input
              type="text"
              placeholder="Username"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              className="w-full h-14 bg-input border-border rounded-3xl px-6 text-foreground placeholder:text-muted-foreground"
              required
            />
          </div>
          
          <div>
            <Input
              type="password"
              placeholder="Password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="w-full h-14 bg-input border-border rounded-3xl px-6 text-foreground placeholder:text-muted-foreground"
              required
            />
          </div>
          
          <Button 
            type="submit"
            className="w-full h-14 bg-primary hover:bg-primary/90 text-primary-foreground rounded-3xl text-lg font-medium transition-all duration-200"
          >
            Login
          </Button>
        </form>
      </div>
    </div>
  );
};

export default LoginPage;