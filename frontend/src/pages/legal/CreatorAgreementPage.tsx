/**
 * Creator Agreement page.
 */

import React from 'react';
import { Link } from 'react-router-dom';
import LegalPageLayout from '../../components/legal/LegalPageLayout';

export default function CreatorAgreementPage() {
  return (
    <LegalPageLayout title="Creator Agreement" lastUpdated="December 2024">
      <p>
        This Creator Agreement ("Agreement") supplements the renaissBlock Terms of Service and
        applies when you publish content on renaissBlock. By publishing, you agree to these
        additional terms.
      </p>

      <hr />

      <h2>1. Creator Eligibility</h2>
      <p>To publish content on renaissBlock, you must:</p>
      <ul>
        <li>Be at least 18 years old</li>
        <li>Have a verified renaissBlock account</li>
        <li>Provide accurate payment and tax information</li>
        <li>Comply with all applicable laws in your jurisdiction</li>
        <li>Accept these terms</li>
      </ul>

      <h2>2. Your Content Rights</h2>

      <h3>2.1 You Own Your Content</h3>
      <p>
        You retain full ownership of all content you create and publish. renaissBlock does not
        claim ownership of your work.
      </p>

      <h3>2.2 License to renaissBlock</h3>
      <p>By publishing, you grant renaissBlock a limited, non-exclusive, worldwide, royalty-free license to:</p>
      <ul>
        <li>Display and distribute your content on the platform</li>
        <li>Create previews, thumbnails, and excerpts</li>
        <li>Promote your content in marketing materials</li>
        <li>Facilitate sales and delivery to purchasers</li>
        <li>Enable platform features (search, recommendations, etc.)</li>
        <li>Store and backup your content</li>
        <li>Modify formatting for display on different devices</li>
      </ul>
      <p>
        This license is solely for operating and improving the platform. It does not grant us
        rights to sell, sublicense, or use your content outside the platform context.
      </p>

      <h3>2.3 Duration</h3>
      <p>This license continues while your content is on the platform and for a reasonable period after removal to:</p>
      <ul>
        <li>Fulfill existing purchases</li>
        <li>Maintain purchaser access</li>
        <li>Comply with legal requirements</li>
        <li>Process any pending transactions</li>
      </ul>

      <h2>3. Your Representations and Warranties</h2>
      <p>By publishing content, you represent and warrant that:</p>

      <h3>3.1 Ownership and Rights</h3>
      <ul>
        <li>You are the original creator of the content, OR</li>
        <li>You have all necessary rights, licenses, and permissions to publish it</li>
        <li>No part of the content infringes any third party's intellectual property</li>
        <li>You have obtained releases from any identifiable individuals (where required)</li>
      </ul>

      <h3>3.2 Content Policy Compliance</h3>
      <ul>
        <li>The content complies with our <Link to="/legal/content-policy">Content Policy</Link></li>
        <li>You have accurately categorized and rated your content</li>
        <li>Any mature content is appropriately marked</li>
      </ul>

      <h2>4. Revenue and Payments</h2>

      <h3>4.1 Pricing</h3>
      <ul>
        <li>You set the price for your content</li>
        <li>Minimum and maximum price limits may apply</li>
        <li>We may offer promotional features (you control participation)</li>
      </ul>

      <h3>4.2 Platform Fees</h3>
      <p>Current fee structure:</p>
      <table>
        <thead>
          <tr>
            <th>Sale Amount</th>
            <th>Platform Fee</th>
          </tr>
        </thead>
        <tbody>
          <tr>
            <td>Under $10</td>
            <td>15%</td>
          </tr>
          <tr>
            <td>$10 - $50</td>
            <td>12%</td>
          </tr>
          <tr>
            <td>Over $50</td>
            <td>10%</td>
          </tr>
        </tbody>
      </table>
      <p>Fees are subject to change with 30 days' notice.</p>

      <h3>4.3 Taxes</h3>
      <ul>
        <li>You are responsible for all taxes on your earnings</li>
        <li>We may collect tax information and issue tax documents as required by law</li>
        <li>We may withhold taxes as required by applicable law</li>
        <li>You should consult a tax professional regarding your obligations</li>
      </ul>

      <h2>5. Collaboration Terms</h2>
      <p>If you collaborate with other creators:</p>

      <h3>5.1 Collaboration Agreements</h3>
      <ul>
        <li>Revenue splits are recorded on the platform</li>
        <li>Published splits are binding and enforced automatically</li>
        <li>Changes require unanimous consent of all collaborators</li>
        <li>Platform cannot mediate disputes over splits</li>
      </ul>

      <h3>5.2 Joint Ownership</h3>
      <ul>
        <li>Collaborative works are jointly owned by all collaborators</li>
        <li>Each collaborator has equal rights unless otherwise agreed</li>
        <li>No collaborator may unilaterally remove a published collaboration</li>
      </ul>

      <h3>5.3 Exit and Removal</h3>
      <ul>
        <li>Delisting (removing from sale) requires majority consent</li>
        <li>Complete deletion requires unanimous consent</li>
        <li>Existing purchasers retain access regardless of delisting</li>
      </ul>

      <h2>6. Content Management</h2>

      <h3>6.1 Publishing</h3>
      <ul>
        <li>Content must meet our quality and policy standards</li>
        <li>We may reject content that violates policies</li>
        <li>Approval does not guarantee compliance (you remain responsible)</li>
        <li>We may remove content at any time for policy violations</li>
      </ul>

      <h3>6.2 Removal</h3>
      <ul>
        <li>You may remove your content from sale at any time</li>
        <li>Existing purchasers retain access to purchased content</li>
        <li>Removal does not affect completed transactions</li>
        <li>We may retain copies for legal and operational purposes</li>
      </ul>

      <h2>7. Analytics and Data</h2>
      <p>We provide analytics including:</p>
      <ul>
        <li>Sales and revenue data</li>
        <li>Audience metrics</li>
        <li>Content performance</li>
        <li>Collaboration statistics</li>
      </ul>
      <p><strong>Purchaser Privacy:</strong> You will NOT receive purchaser email addresses or detailed demographics.</p>

      <h2>8. Disputes</h2>
      <ul>
        <li>Disputes with renaissBlock are governed by the Terms of Service</li>
        <li>We handle refund requests under our policies</li>
        <li>We cannot mediate creative or business disputes between collaborators</li>
        <li>If a third party claims your content infringes their rights, we may remove or restrict content pending resolution</li>
      </ul>

      <h2>9. Termination</h2>

      <h3>9.1 By You</h3>
      <p>You may stop publishing at any time by removing content from sale or closing your account.</p>

      <h3>9.2 By Us</h3>
      <p>We may terminate your creator status for:</p>
      <ul>
        <li>Violation of this Agreement or Terms of Service</li>
        <li>Repeated content policy violations</li>
        <li>Fraudulent activity</li>
        <li>Any reason with 30 days' notice</li>
      </ul>

      <h3>9.3 Effects of Termination</h3>
      <ul>
        <li>You will receive any earned but unpaid revenue (subject to review)</li>
        <li>Existing purchasers may retain content access</li>
        <li>Your content may be removed from the platform</li>
      </ul>

      <h2>10. Contact</h2>
      <p>
        For creator-specific questions: <a href="mailto:creators@renaissblock.com">creators@renaissblock.com</a><br />
        For payment issues: <a href="mailto:payments@renaissblock.com">payments@renaissblock.com</a><br />
        For general support: <a href="mailto:support@renaissblock.com">support@renaissblock.com</a>
      </p>

      <hr />

      <p style={{ fontStyle: 'italic', marginTop: 32 }}>
        By publishing on renaissBlock, you acknowledge that you have read, understood, and agree
        to this Creator Agreement.
      </p>
    </LegalPageLayout>
  );
}
