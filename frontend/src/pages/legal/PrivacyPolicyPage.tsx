/**
 * Privacy Policy page.
 */

import React from 'react';
import LegalPageLayout from '../../components/legal/LegalPageLayout';

export default function PrivacyPolicyPage() {
  return (
    <LegalPageLayout title="Privacy Policy" lastUpdated="December 2024">
      <p>
        renaissBlock ("we," "us," or "our") respects your privacy and is committed to protecting
        your personal information. This Privacy Policy explains how we collect, use, disclose,
        and safeguard your information when you use our platform.
      </p>

      <hr />

      <h2>1. Information We Collect</h2>

      <h3>1.1 Information You Provide</h3>
      <p><strong>Account Information</strong></p>
      <ul>
        <li>Name and display name</li>
        <li>Email address</li>
        <li>Password (encrypted)</li>
        <li>Profile information (bio, avatar, social links)</li>
      </ul>

      <p><strong>Creator Information</strong></p>
      <ul>
        <li>Payment details (bank account, payment preferences)</li>
        <li>Tax information (for 1099 reporting, where applicable)</li>
        <li>Content you upload and publish</li>
      </ul>

      <p><strong>Transaction Information</strong></p>
      <ul>
        <li>Purchase history</li>
        <li>Sales records</li>
        <li>Collaboration agreements and revenue splits</li>
      </ul>

      <h3>1.2 Information Collected Automatically</h3>
      <p><strong>Usage Data</strong></p>
      <ul>
        <li>Pages viewed and features used</li>
        <li>Time spent on the platform</li>
        <li>Clicks, scrolls, and interactions</li>
        <li>Search queries</li>
      </ul>

      <p><strong>Device Information</strong></p>
      <ul>
        <li>Device type and operating system</li>
        <li>Browser type and version</li>
        <li>IP address</li>
        <li>Unique device identifiers</li>
      </ul>

      <h2>2. How We Use Your Information</h2>

      <h3>2.1 Provide the Service</h3>
      <ul>
        <li>Create and manage your account</li>
        <li>Process transactions and payments</li>
        <li>Enable content publishing and collaboration</li>
        <li>Deliver purchased content</li>
        <li>Provide customer support</li>
      </ul>

      <h3>2.2 Improve and Personalize</h3>
      <ul>
        <li>Analyze usage patterns to improve features</li>
        <li>Personalize content recommendations</li>
        <li>Develop new features and services</li>
        <li>Conduct research and analytics</li>
      </ul>

      <h3>2.3 Protect and Secure</h3>
      <ul>
        <li>Detect and prevent fraud</li>
        <li>Enforce our Terms of Service</li>
        <li>Protect against security threats</li>
        <li>Comply with legal obligations</li>
      </ul>

      <h2>3. How We Share Your Information</h2>
      <p><strong>We do not sell your personal information.</strong> We share information only as follows:</p>

      <h3>3.1 With Other Users</h3>
      <ul>
        <li>Your public profile is visible to other users</li>
        <li>Creators' names appear on their published content</li>
        <li>Collaborators can see shared project information</li>
      </ul>

      <h3>3.2 With Service Providers</h3>
      <p>We share information with third parties who help us operate the Service:</p>
      <ul>
        <li><strong>Payment processors</strong> (Stripe) — to process transactions</li>
        <li><strong>Cloud hosting</strong> — to store and serve content</li>
        <li><strong>Analytics providers</strong> — to understand usage</li>
        <li><strong>Email services</strong> — to send communications</li>
      </ul>

      <h3>3.3 For Legal Reasons</h3>
      <p>We may disclose information to comply with legal obligations, respond to lawful requests
      from authorities, or protect our rights, privacy, safety, or property.</p>

      <h2>4. Data Retention</h2>
      <p>We retain your information for as long as necessary to:</p>
      <ul>
        <li>Provide the Service and maintain your account</li>
        <li>Comply with legal obligations (tax records, for example)</li>
        <li>Resolve disputes and enforce agreements</li>
        <li>Maintain security and prevent fraud</li>
      </ul>

      <p><strong>Retention Periods:</strong></p>
      <ul>
        <li>Active account data: Duration of account plus 2 years</li>
        <li>Transaction records: 7 years (for tax/legal compliance)</li>
        <li>Server logs: 90 days</li>
        <li>Marketing data: Until consent withdrawn</li>
      </ul>

      <h2>5. Your Rights and Choices</h2>

      <h3>5.1 Access and Portability</h3>
      <p>You can access most of your information through your account settings. You may request
      a copy of your data by contacting us.</p>

      <h3>5.2 Correction</h3>
      <p>You can update your account information at any time. Contact us for corrections to other data.</p>

      <h3>5.3 Deletion</h3>
      <p>You can delete your account through settings or by contacting us. Note that some data
      must be retained for legal compliance.</p>

      <h3>5.4 Marketing Opt-Out</h3>
      <p>You can opt out of marketing emails by clicking "unsubscribe" in any marketing email
      or adjusting your notification settings.</p>

      <h2>6. California Privacy Rights (CCPA)</h2>
      <p>If you are a California resident, you have additional rights:</p>
      <ul>
        <li><strong>Right to Know:</strong> Request information about data collected</li>
        <li><strong>Right to Delete:</strong> Request deletion of your personal information</li>
        <li><strong>Right to Opt-Out:</strong> We do not sell personal information</li>
        <li><strong>Non-Discrimination:</strong> We will not discriminate for exercising your rights</li>
      </ul>

      <h2>7. European Privacy Rights (GDPR)</h2>
      <p>If you are in the European Economic Area (EEA), UK, or Switzerland, you have the right to:</p>
      <ul>
        <li>Access your personal data</li>
        <li>Rectify inaccurate data</li>
        <li>Erase your data ("right to be forgotten")</li>
        <li>Restrict processing</li>
        <li>Data portability</li>
        <li>Object to processing</li>
        <li>Withdraw consent</li>
        <li>Lodge a complaint with a supervisory authority</li>
      </ul>

      <h2>8. Security</h2>
      <p>We implement appropriate technical and organizational measures to protect your information, including:</p>
      <ul>
        <li>Encryption of data in transit (TLS/SSL)</li>
        <li>Encryption of sensitive data at rest</li>
        <li>Access controls and authentication</li>
        <li>Regular security assessments</li>
        <li>Employee training on data protection</li>
      </ul>

      <h2>9. Children's Privacy</h2>
      <p>
        renaissBlock is not intended for users under 18. We do not knowingly collect information
        from children. If we learn we have collected information from a child, we will delete it
        promptly.
      </p>

      <h2>10. Changes to This Policy</h2>
      <p>
        We may update this Privacy Policy from time to time. We will notify you of material changes
        via email or prominent notice on the Service. Your continued use after changes take effect
        constitutes acceptance.
      </p>

      <h2>11. Contact Us</h2>
      <p>For privacy questions or to exercise your rights:</p>
      <p>
        <strong>renaissBlock</strong><br />
        Email: <a href="mailto:privacy@renaissblock.com">privacy@renaissblock.com</a>
      </p>

      <hr />

      <p style={{ fontStyle: 'italic', marginTop: 32 }}>
        By using renaissBlock, you acknowledge that you have read and understood this Privacy Policy.
      </p>
    </LegalPageLayout>
  );
}
