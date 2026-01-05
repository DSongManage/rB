/**
 * Terms of Service page.
 */

import React from 'react';
import { Link } from 'react-router-dom';
import LegalPageLayout from '../../components/legal/LegalPageLayout';

export default function TermsOfServicePage() {
  return (
    <LegalPageLayout title="Terms of Service" lastUpdated="January 2026">
      <p>
        Welcome to renaissBlock. These Terms of Service ("Terms") govern your access to and use of
        renaissBlock's website, platform, and services (collectively, the "Service"). By accessing
        or using the Service, you agree to be bound by these Terms.
      </p>

      <p>
        <strong>Please read these Terms carefully.</strong> They contain important information about
        your legal rights, including a binding arbitration provision and class action waiver.
      </p>

      <hr />

      <h2>1. Acceptance of Terms</h2>
      <p>By creating an account, accessing, or using renaissBlock, you confirm that:</p>
      <ul>
        <li>You are at least 18 years old (or the age of majority in your jurisdiction)</li>
        <li>You have the legal capacity to enter into a binding agreement</li>
        <li>You are not prohibited from using the Service under applicable law</li>
        <li>You will comply with these Terms and all applicable laws</li>
      </ul>

      <h2>2. Description of Service</h2>
      <p>renaissBlock is a platform that enables creators to:</p>
      <ul>
        <li>Publish and sell digital content (books, art, music, and other creative works)</li>
        <li>Collaborate with other creators on joint projects</li>
        <li>Receive payments for their work</li>
        <li>Build an audience for their creative endeavors</li>
      </ul>
      <p>
        <strong>renaissBlock is a platform, not a publisher.</strong> We do not create, curate,
        endorse, or take responsibility for user-generated content. We provide the tools;
        creators provide the content.
      </p>

      <h2>3. Account Registration and Security</h2>
      <h3>3.1 Account Creation</h3>
      <p>To use certain features, you must create an account. You agree to:</p>
      <ul>
        <li>Provide accurate, current, and complete information</li>
        <li>Maintain and update your information as needed</li>
        <li>Keep your login credentials secure and confidential</li>
        <li>Notify us immediately of any unauthorized access</li>
      </ul>

      <h3>3.2 Digital Wallet</h3>
      <p>The Service includes a digital wallet feature for receiving payments. By using this feature, you acknowledge that:</p>
      <ul>
        <li>You are responsible for maintaining access to your wallet</li>
        <li>Lost wallet credentials may result in permanent loss of funds</li>
        <li>renaissBlock cannot recover lost wallet access in all circumstances</li>
        <li>Digital asset transactions are generally irreversible</li>
      </ul>

      <h2>4. Creator Terms</h2>
      <p>
        If you publish content on renaissBlock, additional terms apply.
        See our <Link to="/legal/creator-agreement">Creator Agreement</Link> for full details.
      </p>

      <h3>4.1 Content Ownership</h3>
      <p>
        You retain all ownership rights to the content you create and publish. By publishing on
        renaissBlock, you grant us a limited, non-exclusive, worldwide license to display,
        distribute, and promote your content on the platform.
      </p>

      <h3>4.2 Revenue and Payments</h3>
      <ul>
        <li>Platform fees are deducted from each sale as described in our Fee Schedule</li>
        <li>Payments are processed through our payment partners</li>
        <li>You are responsible for all applicable taxes on your earnings</li>
      </ul>

      <h2>5. Collaboration Terms</h2>
      <p>renaissBlock enables creators to collaborate on joint works. By entering a collaboration:</p>
      <ul>
        <li>Revenue splits are set by agreement between collaborators</li>
        <li>Once a collaboration is published, splits are enforced automatically</li>
        <li>Changes to splits require unanimous consent of all collaborators</li>
        <li>Collaborators are jointly responsible for the content they create together</li>
      </ul>

      <h2>6. Purchaser Terms</h2>
      <h3>6.1 License Grant</h3>
      <p>
        Purchasing content grants you a personal, non-exclusive, non-transferable license to
        access and enjoy the content for personal use. You may NOT:
      </p>
      <ul>
        <li>Redistribute, resell, or share purchased content</li>
        <li>Remove or alter any copyright notices</li>
        <li>Use content for commercial purposes without creator permission</li>
        <li>Claim ownership of purchased content</li>
      </ul>

      <h3>6.2 Refund Policy</h3>
      <p>Due to the nature of digital goods:</p>
      <ul>
        <li>All sales are generally final</li>
        <li>Refunds may be issued at our discretion for technical issues or content significantly different from its description</li>
        <li>Refund requests must be submitted within 14 days of purchase</li>
      </ul>

      <h2>7. Prohibited Conduct</h2>
      <p>You agree NOT to:</p>
      <ul>
        <li>Upload content you do not have rights to publish</li>
        <li>Publish plagiarized or substantially copied work</li>
        <li>Create content that infringes intellectual property rights</li>
        <li>Publish illegal, defamatory, or fraudulent content</li>
        <li>Manipulate reviews, ratings, or discovery algorithms</li>
        <li>Create fake accounts or impersonate others</li>
        <li>Engage in fraudulent transactions or money laundering</li>
      </ul>

      <h2>8. Intellectual Property</h2>
      <p>
        renaissBlock, our logo, and related marks are our trademarks. Users retain ownership
        of their content. We comply with the Digital Millennium Copyright Act.
        See our <Link to="/legal/dmca">DMCA Policy</Link> for takedown procedures.
      </p>

      <h2>9. Privacy</h2>
      <p>
        Your privacy matters to us. Our <Link to="/legal/privacy">Privacy Policy</Link> explains
        how we collect, use, and protect your information. By using the Service, you consent to
        our data practices as described in the Privacy Policy.
      </p>

      <h2>10. Disclaimers</h2>
      <p>
        THE SERVICE IS PROVIDED "AS IS" AND "AS AVAILABLE" WITHOUT WARRANTIES OF ANY KIND,
        EXPRESS OR IMPLIED. WE DISCLAIM ALL WARRANTIES INCLUDING MERCHANTABILITY, FITNESS FOR
        A PARTICULAR PURPOSE, AND NON-INFRINGEMENT.
      </p>

      <h2>11. Limitation of Liability</h2>
      <p>
        TO THE MAXIMUM EXTENT PERMITTED BY LAW, RENAISSBLOCK'S TOTAL LIABILITY FOR ANY CLAIMS
        ARISING FROM OR RELATED TO THE SERVICE SHALL NOT EXCEED THE GREATER OF: (A) THE AMOUNT
        YOU PAID US IN THE 12 MONTHS PRECEDING THE CLAIM, OR (B) $100.
      </p>

      <h2>12. Dispute Resolution</h2>
      <h3>12.1 Informal Resolution</h3>
      <p>
        Before filing any claim, you agree to contact us at legal@renaissblock.com and attempt
        to resolve the dispute informally for at least 30 days.
      </p>

      <h3>12.2 Binding Arbitration</h3>
      <p>
        Any dispute not resolved informally shall be resolved by binding arbitration under the
        rules of the American Arbitration Association. The arbitration will be conducted in
        Delaware (or remotely). The arbitrator's decision is final and binding.
      </p>

      <h3>12.3 Class Action Waiver</h3>
      <p>
        YOU AGREE THAT ANY DISPUTES WILL BE RESOLVED ONLY ON AN INDIVIDUAL BASIS AND NOT IN A
        CLASS, CONSOLIDATED, OR REPRESENTATIVE ACTION.
      </p>

      <h2>13. Changes to Terms</h2>
      <p>
        We may update these Terms from time to time. We will notify you of material changes via
        email or prominent notice on the Service. Your continued use after changes take effect
        constitutes acceptance.
      </p>

      <h2>14. Contact</h2>
      <p>For questions about these Terms:</p>
      <p>
        <strong>renaissBlock</strong><br />
        Email: <a href="mailto:legal@renaissblock.com">legal@renaissblock.com</a>
      </p>

      <hr />

      <p style={{ fontStyle: 'italic', marginTop: 32 }}>
        By using renaissBlock, you acknowledge that you have read, understood, and agree to be
        bound by these Terms of Service.
      </p>
    </LegalPageLayout>
  );
}
