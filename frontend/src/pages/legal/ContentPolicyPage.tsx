/**
 * Content Policy page.
 */

import React from 'react';
import LegalPageLayout from '../../components/legal/LegalPageLayout';

export default function ContentPolicyPage() {
  return (
    <LegalPageLayout title="Content Policy" lastUpdated="January 2026">
      <p>
        renaissBlock is a platform for serious creators to publish and share original work.
        This Content Policy explains what is and isn't allowed on our platform.
      </p>

      <hr />

      <h2>Our Philosophy</h2>
      <p>
        We believe in creative freedom. We support diverse voices, perspectives, and forms of
        expression. We also recognize that some content can cause harm. This policy balances
        these considerations.
      </p>
      <p><strong>Our approach:</strong></p>
      <ul>
        <li>Default to allowing content unless there's good reason not to</li>
        <li>Focus on clear, egregious violations rather than edge cases</li>
        <li>Apply policies consistently and transparently</li>
        <li>Provide appeals for content decisions</li>
      </ul>

      <hr />

      <h2>1. Prohibited Content</h2>
      <p>The following content is <strong>not allowed</strong> on renaissBlock under any circumstances:</p>

      <h3>1.1 Illegal Content</h3>
      <ul>
        <li>Content that violates applicable law</li>
        <li>Instructions for illegal activities</li>
        <li>Content that facilitates or encourages crime</li>
      </ul>

      <h3>1.2 Child Safety</h3>
      <ul>
        <li>Sexual content involving minors (zero tolerance)</li>
        <li>Content that sexualizes or exploits children</li>
        <li>Content that endangers children's safety</li>
      </ul>

      <h3>1.3 Non-Consensual Content</h3>
      <ul>
        <li>Revenge porn or non-consensual intimate images</li>
        <li>Doxxing (publishing private information without consent)</li>
        <li>Content created through non-consensual recording</li>
      </ul>

      <h3>1.4 Violence and Threats</h3>
      <ul>
        <li>Credible threats of violence against individuals or groups</li>
        <li>Content that incites imminent violence</li>
        <li>Terrorist content or recruitment material</li>
      </ul>

      <h3>1.5 Fraud and Deception</h3>
      <ul>
        <li>Impersonation of real individuals without clear satire indication</li>
        <li>Scams or fraudulent schemes</li>
        <li>Plagiarized content presented as original</li>
      </ul>

      <h3>1.6 Infringement</h3>
      <ul>
        <li>Content that infringes copyright or trademark</li>
        <li>Stolen or pirated content</li>
      </ul>

      <h2>2. Restricted Content</h2>
      <p>The following content has restrictions but is not prohibited outright:</p>

      <h3>2.1 Adult/Mature Content</h3>
      <ul>
        <li>Must be clearly marked as mature content</li>
        <li>Must not be the primary purpose of an account</li>
        <li>May not appear in general discovery/search</li>
        <li>Subject to age-gating requirements</li>
      </ul>

      <h3>2.2 Graphic Violence</h3>
      <ul>
        <li>May be allowed in appropriate context (literary fiction, historical accounts)</li>
        <li>Must be marked appropriately</li>
        <li>Gratuitous violence without narrative purpose may be restricted</li>
      </ul>

      <h3>2.3 AI-Generated Content</h3>
      <ul>
        <li>Must be disclosed if substantially AI-generated</li>
        <li>Human authorship/curation/editing expected</li>
        <li>Pure AI output without meaningful human contribution is not appropriate for the platform</li>
      </ul>

      <h2>3. Quality Standards</h2>
      <p>While we don't judge artistic merit, we maintain basic quality standards:</p>

      <h3>3.1 Original Work</h3>
      <ul>
        <li>Content must be substantially original</li>
        <li>Proper attribution required for any incorporated material</li>
        <li>Fan fiction and derivative works must comply with applicable rights</li>
      </ul>

      <h3>3.2 Complete Works</h3>
      <ul>
        <li>Published content should be complete as advertised</li>
        <li>Incomplete works must be clearly labeled</li>
        <li>"Coming soon" placeholders without content are not permitted</li>
      </ul>

      <h3>3.3 Accurate Descriptions</h3>
      <ul>
        <li>Titles and descriptions must accurately represent content</li>
        <li>Misleading metadata is prohibited</li>
        <li>Category selection must be appropriate</li>
      </ul>

      <h2>4. Creator Responsibilities</h2>
      <p>As a creator on renaissBlock, you are responsible for:</p>
      <ul>
        <li>Ensuring you have rights to publish your content</li>
        <li>Obtaining necessary permissions, licenses, or releases</li>
        <li>Truthfully representing yourself and your work</li>
        <li>Treating other users with respect</li>
        <li>Complying with laws applicable to you and your content</li>
      </ul>

      <h2>5. Enforcement</h2>

      <h3>5.1 Actions We May Take</h3>
      <p><strong>For prohibited content:</strong></p>
      <ul>
        <li>Immediate removal</li>
        <li>Account warning or suspension</li>
        <li>Permanent termination for serious violations</li>
      </ul>

      <p><strong>For restricted content violations:</strong></p>
      <ul>
        <li>Content flagged for age restriction</li>
        <li>Metadata corrections required</li>
        <li>Temporary restriction pending review</li>
      </ul>

      <h3>5.2 Gradual Enforcement</h3>
      <p>For most violations, we follow a progressive approach:</p>
      <ol>
        <li><strong>Warning:</strong> First violation typically results in a warning</li>
        <li><strong>Restriction:</strong> Repeated violations may limit account features</li>
        <li><strong>Suspension:</strong> Serious or continued violations may result in temporary suspension</li>
        <li><strong>Termination:</strong> Egregious or persistent violations result in permanent removal</li>
      </ol>
      <p>
        <strong>Exceptions:</strong> Zero-tolerance violations (child safety, credible threats)
        result in immediate termination without warning.
      </p>

      <h3>5.3 Appeals</h3>
      <p>If you believe a decision was made in error:</p>
      <ul>
        <li>Submit an appeal within 14 days</li>
        <li>Explain why you believe the decision was incorrect</li>
        <li>Provide any relevant context or evidence</li>
        <li>Appeals are reviewed by a different team member</li>
      </ul>
      <p>Contact: <a href="mailto:appeals@renaissblock.com">appeals@renaissblock.com</a></p>

      <h2>6. Reporting Violations</h2>

      <h3>6.1 How to Report</h3>
      <ul>
        <li>Use the "Report" button on any content</li>
        <li>Email: <a href="mailto:reports@renaissblock.com">reports@renaissblock.com</a></li>
        <li>For urgent safety concerns: <a href="mailto:safety@renaissblock.com">safety@renaissblock.com</a></li>
      </ul>

      <h3>6.2 False Reports</h3>
      <p>
        Repeatedly filing false reports may result in action against your account.
        Only report genuine violations.
      </p>

      <h2>7. Questions</h2>
      <p>
        For questions about this policy: <a href="mailto:content@renaissblock.com">content@renaissblock.com</a>
      </p>

      <hr />

      <p style={{ fontStyle: 'italic', marginTop: 32 }}>
        renaissBlock is a platform built by creators, for creators. Help us maintain a community
        where original work thrives and everyone can create with confidence.
      </p>
    </LegalPageLayout>
  );
}
