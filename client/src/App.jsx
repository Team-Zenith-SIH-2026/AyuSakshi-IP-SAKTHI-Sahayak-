import React from 'react';
import { ThemeProvider } from './context/ThemeContext';
import { AuthProvider } from './context/AuthContext';
import { JurisdictionProvider } from './context/JurisdictionContext';
import { ChatProvider } from './context/ChatContext';

import { Header } from './components/layout/Header';
import { Sidebar } from './components/layout/Sidebar';
import { ChatArea } from './components/chat/ChatArea';
import { QuickActionBar } from './components/chat/QuickActionBar';
import { SourceDrawer } from './components/chat/SourceDrawer';

import { AuthModal } from './components/auth/AuthModal';
import { ClassificationWizard } from './components/classification/ClassificationWizard';
import { ABSNavigator } from './components/abs/ABSNavigator';
import { TKDLChecker } from './components/tkdl/TKDLChecker';
import { EscalationModal } from './components/escalation/EscalationModal';
import { FacilitatorQueue } from './components/facilitator/FacilitatorQueue';
import { KnowledgeBaseManager } from './components/admin/KnowledgeBaseManager';

function MainLayout() {
  return (
    <div className="flex flex-col h-screen w-screen bg-slate-50 dark:bg-darkbg-950 text-slate-900 dark:text-slate-100 overflow-hidden font-sans transition-colors duration-200">
      <Header />
      
      <div className="flex flex-1 overflow-hidden">
        <Sidebar />
        
        <main className="flex-1 flex flex-col justify-between overflow-hidden bg-slate-100/50 dark:bg-[#070e12]/60">
          <ChatArea />
          <QuickActionBar />
        </main>
      </div>

      {/* Global Modals & Overlay Drawers */}
      <SourceDrawer />
      <AuthModal />
      <ClassificationWizard />
      <ABSNavigator />
      <TKDLChecker />
      <EscalationModal />
      <FacilitatorQueue />
      <KnowledgeBaseManager />
    </div>
  );
}

export default function App() {
  return (
    <ThemeProvider>
      <AuthProvider>
        <JurisdictionProvider>
          <ChatProvider>
            <MainLayout />
          </ChatProvider>
        </JurisdictionProvider>
      </AuthProvider>
    </ThemeProvider>
  );
}
