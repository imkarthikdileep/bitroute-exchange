
import { Link } from "react-router-dom";
import { Navbar } from "@/components/Navbar";
import { ArrowRight } from "lucide-react";

const Index = () => {
  return (
    <div className="min-h-screen flex flex-col">
      <Navbar />
      
      <main className="flex-1 pt-24 px-6">
        <section className="py-20 md:py-32 container max-w-7xl mx-auto">
          <div className="max-w-3xl mx-auto text-center space-y-8 animate-fade-in">
            <div className="space-y-4">
              <p className="inline-block px-3 py-1 rounded-full text-xs font-semibold bg-primary/10 text-primary">
                Secure. Fast. Simple.
              </p>
              <h1 className="logo text-5xl md:text-7xl font-bold tracking-tight">
                BitRoute
              </h1>
              <p className="text-xl md:text-2xl text-muted-foreground mt-4 max-w-2xl mx-auto">
                Transfer files peer-to-peer with end-to-end encryption. 
                No servers, no limits, no complications.
              </p>
            </div>
            
            <div className="flex flex-col sm:flex-row gap-4 justify-center items-center">
              <Link 
                to="/transfer" 
                className="group inline-flex items-center justify-center gap-2 px-5 py-3 bg-primary text-primary-foreground rounded-lg transition-all hover:bg-primary/90"
              >
                <span>Get Started</span>
                <ArrowRight size={16} className="transition-transform group-hover:translate-x-1" />
              </Link>
              <a 
                href="#features" 
                className="inline-flex items-center justify-center gap-2 px-5 py-3 bg-secondary text-secondary-foreground rounded-lg transition-colors hover:bg-secondary/80"
              >
                Learn More
              </a>
            </div>
          </div>
        </section>
        
        <section id="features" className="py-20 container max-w-7xl mx-auto">
          <div className="space-y-12">
            <div className="text-center space-y-4 max-w-3xl mx-auto">
              <h2 className="text-3xl md:text-4xl font-bold">A Better Way to Share</h2>
              <p className="text-muted-foreground text-lg">
                BitRoute is built with privacy and simplicity at its core.
              </p>
            </div>
            
            <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
              {features.map((feature, i) => (
                <div key={i} className="glass-card p-6 rounded-xl space-y-4 transition-all hover:translate-y-[-2px]">
                  <div className="w-12 h-12 rounded-lg bg-primary/10 flex items-center justify-center">
                    {feature.icon}
                  </div>
                  <h3 className="text-xl font-semibold">{feature.title}</h3>
                  <p className="text-muted-foreground">{feature.description}</p>
                </div>
              ))}
            </div>
          </div>
        </section>
      </main>
      
      <footer className="py-12 px-6 border-t">
        <div className="container max-w-7xl mx-auto">
          <div className="flex flex-col md:flex-row justify-between items-center gap-4">
            <p className="text-sm text-muted-foreground">
              © {new Date().getFullYear()} BitRoute. All rights reserved.
            </p>
            <div className="flex items-center gap-6">
              <a href="#" className="text-sm text-muted-foreground hover:text-foreground transition-colors">
                Privacy
              </a>
              <a href="#" className="text-sm text-muted-foreground hover:text-foreground transition-colors">
                Terms
              </a>
              <a href="#" className="text-sm text-muted-foreground hover:text-foreground transition-colors">
                Contact
              </a>
            </div>
          </div>
        </div>
      </footer>
    </div>
  );
};

const features = [
  {
    title: "End-to-End Encryption",
    description: "All transfers are secured with strong encryption. Your data never touches our servers.",
    icon: <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="lucide lucide-lock"><rect width="18" height="11" x="3" y="11" rx="2" ry="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/></svg>
  },
  {
    title: "No File Size Limits",
    description: "Transfer files of any size without compression or quality loss.",
    icon: <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="lucide lucide-infinity"><path d="M12 12c-2-2.67-4-4-6-4a4 4 0 1 0 0 8c2 0 4-1.33 6-4Zm0 0c2 2.67 4 4 6 4a4 4 0 0 0 0-8c-2 0-4 1.33-6 4Z"/></svg>
  },
  {
    title: "Direct Connection",
    description: "Files transfer directly between devices using WebRTC, ensuring maximum speed.",
    icon: <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="lucide lucide-arrow-right-left"><path d="m16 3 4 4-4 4"/><path d="M20 7H4"/><path d="m8 21-4-4 4-4"/><path d="M4 17h16"/></svg>
  }
];

export default Index;
