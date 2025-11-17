import React from 'react';
import { useAppContext } from '../App';
import { Page } from '../types';

const PrivacyPage: React.FC = () => {
  const { setPage } = useAppContext();

  return (
    <div className="max-w-4xl mx-auto bg-white p-8 rounded-lg shadow-md">
      <h2 className="text-3xl font-serif font-bold mb-6 text-stanford-charcoal">Privacy Statement</h2>
      
      <div className="space-y-4 text-gray-700">
        <p><strong>Last Updated: November 18, 2025</strong></p>
        
        <p>This Privacy Statement explains how the Stanford Law School Oral Argument Coach ("we," "us," or "our") collects, uses, and discloses information about you when you use our web application (the "Service").</p>
        
        <h3 className="text-xl font-serif font-semibold pt-4">1. Information We Collect</h3>
        <p>We collect the following types of information:</p>
        <ul className="list-disc list-inside ml-4">
          <li><strong>Session Data:</strong> This includes the settings you select for your practice session, the case summary you choose or provide, and the full audio transcript of your session. Your voice input is processed in real-time to generate text and is not stored long-term on our servers after the session feedback is generated.</li>
          <li><strong>Usage Information:</strong> We do not currently collect personal usage information, such as IP addresses or browser details, for tracking purposes.</li>
        </ul>

        <h3 className="text-xl font-serif font-semibold pt-4">2. How We Use Your Information</h3>
        <p>The information collected is used solely for the purpose of providing and improving the Service. Specifically:</p>
        <ul className="list-disc list-inside ml-4">
          <li>To conduct your simulated oral argument session.</li>
          <li>To generate a transcript and personalized feedback on your performance.</li>
          <li>The session data is processed by Google's Gemini AI models to facilitate the interactive experience and generate responses.</li>
        </ul>

        <h3 className="text-xl font-serif font-semibold pt-4">3. Data Storage and Security</h3>
        <p>Your session transcript and generated feedback are available for you to download as a PDF at the end of your session. This data is not permanently stored on our servers and will be discarded once you leave the feedback page or start a new session. We do not retain personal copies of your practice sessions.</p>

        <h3 className="text-xl font-serif font-semibold pt-4">4. Third-Party Services</h3>
        <p>This application utilizes the Google Gemini API. Your interactions are subject to Google's Privacy Policy. We do not share your data with any other third parties.</p>

        <h3 className="text-xl font-serif font-semibold pt-4">5. Your Rights</h3>
        <p>As we do not store your personal data long-term, you can manage your data by simply choosing not to download the report at the end of a session. All session-related data is transient.</p>
        
        <h3 className="text-xl font-serif font-semibold pt-4">6. Changes to This Privacy Statement</h3>
        <p>We may update this Privacy Statement from time to time. We will notify you of any changes by posting the new Privacy Statement on this page.</p>
        
        <h3 className="text-xl font-serif font-semibold pt-4">7. Contact Us</h3>
        <p>If you have any questions about this Privacy Statement, please contact the Robert Crown Law Library.</p>
      </div>

      <div className="text-center mt-8">
        <button 
          onClick={() => setPage(Page.Home)}
          className="px-8 py-2 bg-stanford-red text-white font-semibold rounded-lg shadow-md hover:bg-red-800 transition-colors"
        >
          Back to Home
        </button>
      </div>
    </div>
  );
};

export default PrivacyPage;