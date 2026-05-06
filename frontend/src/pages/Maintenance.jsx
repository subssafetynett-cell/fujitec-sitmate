import React from 'react';
import { motion } from 'framer-motion';
import { Clock, Mail, ShieldAlert } from 'lucide-react';

const Maintenance = () => {
  return (
    <div className="min-h-screen bg-[#020617] flex flex-col items-center justify-center relative overflow-hidden font-sans selection:bg-blue-500/30">
      {/* Background Ambience */}
      <div className="absolute inset-0 z-0">
        <div className="absolute top-0 left-0 w-full h-full bg-[radial-gradient(circle_at_50%_50%,rgba(30,58,138,0.1),transparent_80%)]" />
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[600px] bg-blue-600/5 blur-[150px] rounded-full" />
      </div>

      {/* Main Content */}
      <motion.div 
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ duration: 1 }}
        className="relative z-10 w-full max-w-4xl px-6 flex flex-col items-center text-center"
      >
        {/* Animated Icon */}
        <motion.div
          animate={{ 
            scale: [1, 1.1, 1],
            rotate: [0, 5, -5, 0]
          }}
          transition={{ 
            duration: 4, 
            repeat: Infinity,
            ease: "easeInOut" 
          }}
          className="mb-12"
        >
          <div className="bg-blue-500/10 p-6 rounded-3xl border border-blue-500/20 backdrop-blur-xl shadow-[0_0_50px_rgba(59,130,246,0.1)]">
            <ShieldAlert className="w-12 h-12 text-blue-400" />
          </div>
        </motion.div>

        {/* Hero Text */}
        <div className="max-w-3xl">
          <motion.h1 
            initial={{ y: 30, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            transition={{ delay: 0.2, duration: 0.8, ease: "easeOut" }}
            className="text-6xl md:text-8xl font-black text-white mb-8 tracking-tighter leading-none"
          >
            UNDER <br />
            <span className="text-transparent bg-clip-text bg-gradient-to-r from-blue-500 via-indigo-400 to-cyan-400 animate-gradient-x">
              MAINTENANCE
            </span>
          </motion.h1>

          <motion.div
            initial={{ width: 0 }}
            animate={{ width: "100px" }}
            transition={{ delay: 0.8, duration: 1 }}
            className="h-1 bg-gradient-to-r from-blue-500 to-transparent mx-auto mb-10"
          />

          <motion.p 
            initial={{ y: 20, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            transition={{ delay: 0.5, duration: 0.6 }}
            className="text-slate-400 text-lg md:text-2xl mb-16 font-light tracking-wide max-w-xl mx-auto leading-relaxed"
          >
            We're currently refining our experience. <br className="hidden md:block" />
            The application will be back online shortly.
          </motion.p>

          {/* Centered Info Cards */}
          <div className="flex flex-col sm:flex-row items-center justify-center gap-6 mb-20">
            <motion.div 
              initial={{ x: -20, opacity: 0 }}
              animate={{ x: 0, opacity: 1 }}
              transition={{ delay: 0.7, duration: 0.6 }}
              className="group flex items-center gap-4 bg-slate-900/40 backdrop-blur-md border border-slate-800/50 px-6 py-4 rounded-2xl hover:bg-slate-900/60 transition-all"
            >
              <Clock className="w-5 h-5 text-blue-500" />
              <div className="text-left">
                <p className="text-slate-500 text-[10px] uppercase tracking-widest font-bold">Status</p>
                <p className="text-white font-medium text-sm">Upgrading Servers</p>
              </div>
            </motion.div>

            <motion.div 
              initial={{ x: 20, opacity: 0 }}
              animate={{ x: 0, opacity: 1 }}
              transition={{ delay: 0.8, duration: 0.6 }}
              className="group flex items-center gap-4 bg-slate-900/40 backdrop-blur-md border border-slate-800/50 px-6 py-4 rounded-2xl hover:bg-slate-900/60 transition-all"
            >
              <Mail className="w-5 h-5 text-indigo-400" />
              <div className="text-left">
                <p className="text-slate-500 text-[10px] uppercase tracking-widest font-bold">Inquiries</p>
                <p className="text-white font-medium text-sm">support@safety-net.co.uk</p>
              </div>
            </motion.div>
          </div>
        </div>

        {/* Progress Bar (Decorative) */}
        <div className="w-full max-w-xs h-1 bg-slate-900 rounded-full overflow-hidden mb-20">
          <motion.div 
            animate={{ x: ["-100%", "100%"] }}
            transition={{ duration: 2, repeat: Infinity, ease: "linear" }}
            className="w-1/2 h-full bg-gradient-to-r from-transparent via-blue-500 to-transparent"
          />
        </div>

        {/* Minimal Footer */}
        <motion.div 
          initial={{ opacity: 0 }}
          animate={{ opacity: 0.4 }}
          transition={{ delay: 1.2, duration: 1 }}
          className="text-slate-500 text-[10px] uppercase tracking-[0.4em]"
        >
          &copy; {new Date().getFullYear()} SafetyNet Infrastructure
        </motion.div>
      </motion.div>

      {/* Subtle Noise/Texture Overlay */}
      <div className="absolute inset-0 opacity-[0.03] pointer-events-none bg-[url('https://grainy-gradients.vercel.app/noise.svg')]" />
    </div>
  );
};

export default Maintenance;
