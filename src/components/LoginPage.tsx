import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { User, Loader2 } from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";

const LoginPage = () => {
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const { login, isLoading } = useAuth();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!username.trim() || !password.trim()) return;
    
    try {
      await login(username, password);
    } catch (error) {
      // Error is handled in AuthContext
      console.error('Login failed:', error);
    }
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
          <h1 className="text-2xl font-bold text-foreground mb-2">
            Container Manager
          </h1>
          <p className="text-muted-foreground">
            Masuk untuk mengelola container Anda
          </p>
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
              disabled={isLoading}
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
              disabled={isLoading}
            />
          </div>
          
          <Button 
            type="submit"
            disabled={isLoading || !username.trim() || !password.trim()}
            className="w-full h-14 bg-primary hover:bg-primary/90 text-primary-foreground rounded-3xl text-lg font-medium transition-all duration-200 disabled:opacity-50"
          >
            {isLoading ? (
              <>
                <Loader2 className="w-5 h-5 mr-2 animate-spin" />
                Masuk...
              </>
            ) : (
              "Login"
            )}
          </Button>
        </form>
        
        <div className="text-center text-sm text-muted-foreground">
          <p>Default credentials:</p>
          <p>Username: <code className="bg-muted px-1 rounded">admin</code></p>
          <p>Password: <code className="bg-muted px-1 rounded">admin123</code></p>
        </div>
      </div>
    </div>
  );
};

export default LoginPage;
