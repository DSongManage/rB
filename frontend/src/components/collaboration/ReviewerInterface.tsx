import React, { useState, useEffect } from 'react';
import {
  CollaborativeProject,
  ProjectSection,
  ProjectComment,
  collaborationApi,
} from '../../services/collaborationApi';
import { sanitizeHtml } from '../../utils/sanitize';
import { Eye, MessageSquare, Send, FileText, Image, Music, Video, CheckCircle } from 'lucide-react';

interface User {
  id: number;
  username: string;
  display_name?: string;
}

interface ReviewerInterfaceProps {
  project: CollaborativeProject;
  currentUser: User;
  reviewableTypes: string[];
  onCommentAdd?: (comment: ProjectComment) => void;
}

export default function ReviewerInterface({
  project,
  currentUser,
  reviewableTypes,
  onCommentAdd,
}: ReviewerInterfaceProps) {
  const [sections, setSections] = useState<ProjectSection[]>([]);
  const [comments, setComments] = useState<ProjectComment[]>([]);
  const [selectedSectionId, setSelectedSectionId] = useState<number | null>(null);
  const [newComment, setNewComment] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [loading, setLoading] = useState(true);

  // Load sections and comments
  useEffect(() => {
    loadContent();
  }, [project.id]);

  const loadContent = async () => {
    setLoading(true);
    try {
      const [sectionsData, commentsData] = await Promise.all([
        collaborationApi.getProjectSections(project.id),
        collaborationApi.getComments(project.id),
      ]);

      // Filter sections to only those the reviewer can see
      const filteredSections = sectionsData.filter((s: ProjectSection) =>
        reviewableTypes.includes(s.section_type)
      );
      setSections(filteredSections);
      setComments(commentsData);

      if (filteredSections.length > 0) {
        setSelectedSectionId(filteredSections[0].id);
      }
    } catch (err) {
      console.error('Failed to load content:', err);
    } finally {
      setLoading(false);
    }
  };

  const selectedSection = sections.find(s => s.id === selectedSectionId);
  const sectionComments = comments.filter(c =>
    !c.parent_comment // Only top-level comments for now
  );

  const handleSubmitComment = async () => {
    if (!newComment.trim()) return;

    setSubmitting(true);
    try {
      const comment = await collaborationApi.addComment({
        project: project.id,
        content: newComment,
      });
      setComments([...comments, comment]);
      setNewComment('');
      if (onCommentAdd) {
        onCommentAdd(comment);
      }
    } catch (err) {
      console.error('Failed to submit comment:', err);
    } finally {
      setSubmitting(false);
    }
  };

  const getSectionIcon = (type: string) => {
    switch (type) {
      case 'text': return <FileText size={16} />;
      case 'image': return <Image size={16} />;
      case 'audio': return <Music size={16} />;
      case 'video': return <Video size={16} />;
      default: return <FileText size={16} />;
    }
  };

  if (loading) {
    return (
      <div style={{ padding: 40, textAlign: 'center', color: '#94a3b8' }}>
        Loading content...
      </div>
    );
  }

  return (
    <div style={{ display: 'grid', gridTemplateColumns: '250px 1fr 300px', gap: 20, height: '100%' }}>
      {/* Section list */}
      <div style={{
        background: '#1e293b',
        borderRadius: 12,
        padding: 16,
        overflow: 'auto',
      }}>
        <div style={{
          display: 'flex',
          alignItems: 'center',
          gap: 8,
          marginBottom: 16,
          color: '#f8fafc',
          fontWeight: 600,
        }}>
          <Eye size={18} />
          Review Content
        </div>

        <div style={{ fontSize: 11, color: '#64748b', marginBottom: 12 }}>
          You have read-only access to review the following content types: {reviewableTypes.join(', ')}
        </div>

        {sections.length === 0 ? (
          <div style={{ color: '#64748b', fontSize: 13, textAlign: 'center', padding: 20 }}>
            No content available for review yet.
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {sections.map(section => (
              <button
                key={section.id}
                onClick={() => setSelectedSectionId(section.id)}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 10,
                  padding: 12,
                  background: selectedSectionId === section.id ? 'rgba(245,158,11,0.15)' : '#0f172a',
                  border: `1px solid ${selectedSectionId === section.id ? '#f59e0b' : '#334155'}`,
                  borderRadius: 8,
                  cursor: 'pointer',
                  textAlign: 'left',
                }}
              >
                <span style={{ color: selectedSectionId === section.id ? '#f59e0b' : '#94a3b8' }}>
                  {getSectionIcon(section.section_type)}
                </span>
                <div style={{ flex: 1, overflow: 'hidden' }}>
                  <div style={{
                    color: selectedSectionId === section.id ? '#f59e0b' : '#f8fafc',
                    fontSize: 13,
                    fontWeight: 600,
                    overflow: 'hidden',
                    textOverflow: 'ellipsis',
                    whiteSpace: 'nowrap',
                  }}>
                    {section.title}
                  </div>
                  <div style={{ color: '#64748b', fontSize: 11 }}>
                    by @{section.owner_username}
                  </div>
                </div>
              </button>
            ))}
          </div>
        )}
      </div>

      {/* Content viewer */}
      <div style={{
        background: '#1e293b',
        borderRadius: 12,
        padding: 20,
        overflow: 'auto',
      }}>
        {selectedSection ? (
          <>
            <div style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              marginBottom: 16,
              paddingBottom: 16,
              borderBottom: '1px solid #334155',
            }}>
              <div>
                <h3 style={{ color: '#f8fafc', margin: 0, fontSize: 18 }}>
                  {selectedSection.title}
                </h3>
                <div style={{ color: '#64748b', fontSize: 12, marginTop: 4 }}>
                  Written by @{selectedSection.owner_username}
                </div>
              </div>
              <div style={{
                display: 'flex',
                alignItems: 'center',
                gap: 6,
                padding: '6px 12px',
                background: 'rgba(16,185,129,0.15)',
                borderRadius: 6,
                color: '#10b981',
                fontSize: 11,
                fontWeight: 600,
              }}>
                <Eye size={14} />
                Read Only
              </div>
            </div>

            {/* Content display based on type */}
            {selectedSection.section_type === 'text' && (
              <div
                style={{
                  color: '#cbd5e1',
                  fontSize: 15,
                  lineHeight: 1.8,
                }}
                dangerouslySetInnerHTML={{ __html: sanitizeHtml(selectedSection.content_html) || '<em>No content yet</em>' }}
              />
            )}

            {selectedSection.section_type === 'image' && selectedSection.media_file && (
              <div style={{ textAlign: 'center' }}>
                <img
                  src={selectedSection.media_file}
                  alt={selectedSection.title}
                  style={{ maxWidth: '100%', borderRadius: 8 }}
                />
              </div>
            )}

            {selectedSection.section_type === 'audio' && selectedSection.media_file && (
              <audio controls style={{ width: '100%' }}>
                <source src={selectedSection.media_file} />
                Your browser does not support the audio element.
              </audio>
            )}

            {selectedSection.section_type === 'video' && selectedSection.media_file && (
              <video controls style={{ width: '100%', borderRadius: 8 }}>
                <source src={selectedSection.media_file} />
                Your browser does not support the video element.
              </video>
            )}
          </>
        ) : (
          <div style={{ color: '#64748b', textAlign: 'center', padding: 40 }}>
            Select a section to review
          </div>
        )}
      </div>

      {/* Comments panel */}
      <div style={{
        background: '#1e293b',
        borderRadius: 12,
        padding: 16,
        display: 'flex',
        flexDirection: 'column',
      }}>
        <div style={{
          display: 'flex',
          alignItems: 'center',
          gap: 8,
          marginBottom: 16,
          color: '#f8fafc',
          fontWeight: 600,
        }}>
          <MessageSquare size={18} />
          Comments ({sectionComments.length})
        </div>

        {/* Comment list */}
        <div style={{ flex: 1, overflow: 'auto', marginBottom: 16 }}>
          {sectionComments.length === 0 ? (
            <div style={{ color: '#64748b', fontSize: 13, textAlign: 'center', padding: 20 }}>
              No comments yet. Be the first to leave feedback!
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
              {sectionComments.map(comment => (
                <div
                  key={comment.id}
                  style={{
                    padding: 12,
                    background: '#0f172a',
                    borderRadius: 8,
                    borderLeft: comment.resolved ? '3px solid #10b981' : '3px solid #334155',
                  }}
                >
                  <div style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: 8,
                    marginBottom: 6,
                  }}>
                    <span style={{ color: '#f59e0b', fontWeight: 600, fontSize: 12 }}>
                      @{comment.author_username}
                    </span>
                    {comment.resolved && (
                      <span style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: 4,
                        color: '#10b981',
                        fontSize: 10,
                      }}>
                        <CheckCircle size={12} />
                        Resolved
                      </span>
                    )}
                  </div>
                  <div style={{ color: '#cbd5e1', fontSize: 13, lineHeight: 1.5 }}>
                    {comment.content}
                  </div>
                  <div style={{ color: '#64748b', fontSize: 10, marginTop: 6 }}>
                    {new Date(comment.created_at).toLocaleString()}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* New comment input */}
        <div style={{
          borderTop: '1px solid #334155',
          paddingTop: 16,
        }}>
          <textarea
            value={newComment}
            onChange={(e) => setNewComment(e.target.value)}
            placeholder="Leave feedback or suggestions..."
            style={{
              width: '100%',
              background: '#0f172a',
              border: '1px solid #334155',
              borderRadius: 8,
              padding: 12,
              color: '#f8fafc',
              fontSize: 13,
              fontFamily: 'inherit',
              resize: 'none',
              minHeight: 80,
            }}
          />
          <button
            onClick={handleSubmitComment}
            disabled={submitting || !newComment.trim()}
            style={{
              width: '100%',
              marginTop: 8,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: 8,
              padding: '10px 16px',
              background: submitting || !newComment.trim() ? '#334155' : '#f59e0b',
              border: 'none',
              borderRadius: 8,
              color: submitting || !newComment.trim() ? '#64748b' : '#000',
              fontWeight: 600,
              fontSize: 13,
              cursor: submitting || !newComment.trim() ? 'not-allowed' : 'pointer',
            }}
          >
            <Send size={14} />
            {submitting ? 'Submitting...' : 'Submit Comment'}
          </button>
        </div>
      </div>
    </div>
  );
}
