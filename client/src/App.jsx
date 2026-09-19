import React from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { ThemeProvider } from './context/ThemeContext';
import { LanguageProvider } from './context/LanguageContext';
import { AuthProvider, useAuth } from './context/AuthContext';
import { JurisdictionProvider } from './context/JurisdictionContext';
import { ChatProvider } from './context/ChatContext';

import { Header } from './components/layout/Header';
import { Sidebar } from './components/layout/Sidebar';
import { DisclaimerBar } from './components/layout/DisclaimerBar';
import { BotanicalBackdrop } from './components/layout/BotanicalBackdrop';
import { ChatArea } from './components/chat/ChatArea';
import { QuickActionBar } from './components/chat/QuickActionBar';
import { SourceDrawer } from './components/chat/SourceDrawer';

import { AuthModal } from './components/auth/AuthModal';
import { ProtectedRoute } from './components/auth/ProtectedRoute';
import { ForcePasswordChangeModal } from './components/auth/ForcePasswordChangeModal';
import { ClassificationWizard } from './components/classification/ClassificationWizard';
import { ABSNavigator } from './components/abs/ABSNavigator';
import { TKDLChecker } from './components/tkdl/TKDLChecker';
import { EscalationModal } from './components/escalation/EscalationModal';
import { FacilitatorQueue } from './components/facilitator/FacilitatorQueue';
import { KnowledgeBaseManager } from './components/admin/KnowledgeBaseManager';

import { ProfilePage } from './pages/ProfilePage';
import { ForgotPasswordPage } from './pages/ForgotPasswordPage';
import { OAuthCallbackPage } from './pages/OAuthCallbackPage';
import { AdminPortalPage } from './pages/admin/AdminPortalPage';
import { FacilitatorWorkspacePage } from './pages/facilitator/FacilitatorWorkspacePage';

import { RightPanel } from './components/layout/RightPanel';
import { useChat } from './context/ChatContext';

function AssistantLayout() {
  const { messages } = useChat();
  const { user } = useAuth();

  // Facilitators are dedicated to the review workspace; redirect immediately
  if (user?.role === 'facilitator') {
    return <Navigate to="/facilitator" replace />;
  }

  return (
    <div className="relative flex h-screen h-[100dvh] w-full max-w-full flex-col overflow-hidden overflow-x-hidden font-sans text-slate-900 transition-colors duration-200 dark:text-slate-100">
      <BotanicalBackdrop />

      <Header />

      <div className="relative flex w-full flex-1 overflow-hidden">
        <Sidebar />

        <main className="flex w-full min-w-0 flex-1 flex-col justify-between overflow-hidden">
          <ChatArea />
          {messages.length > 0 && (
            <div className="w-full flex-shrink-0 border-t border-emerald-900/[0.06] bg-white/70 backdrop-blur-md dark:border-emerald-700/20 dark:bg-[#0c241c]/80">
              <div className="mx-auto max-w-4xl px-4 py-3 sm:px-6">
                <QuickActionBar />
              </div>
            </div>
          )}
        </main>

        <RightPanel />
      </div>

      {/* Always visible, not dismissible. Required by the problem statement. */}
      <DisclaimerBar />

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
    <BrowserRouter>
      <ThemeProvider>
        <LanguageProvider>
          <AuthProvider>
            <JurisdictionProvider>
              <ChatProvider>
                <ForcePasswordChangeModal />
                <Routes>
                  <Route path="/" element={<AssistantLayout />} />
                  <Route path="/profile" element={<ProfilePage />} />
                  <Route path="/forgot-password" element={<ForgotPasswordPage />} />
                  <Route path="/auth/callback" element={<OAuthCallbackPage />} />

                  {/* Admin Portal (Restricted to role: admin) */}
                  <Route
                    path="/admin/*"
                    element={
                      <ProtectedRoute allowedRoles={['admin']}>
                        <AdminPortalPage />
                      </ProtectedRoute>
                    }
                  />

                  {/* Facilitator Workspace (Restricted to role: facilitator) */}
                  <Route
                    path="/facilitator/*"
                    element={
                      <ProtectedRoute allowedRoles={['facilitator']}>
                        <FacilitatorWorkspacePage />
                      </ProtectedRoute>
                    }
                  />

                  <Route path="*" element={<Navigate to="/" replace />} />
                </Routes>
              </ChatProvider>
            </JurisdictionProvider>
          </AuthProvider>
        </LanguageProvider>
      </ThemeProvider>
    </BrowserRouter>
  );
}
