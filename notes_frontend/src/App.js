import React, { useEffect, useMemo, useRef, useState } from 'react';
import './App.css';

const API_BASE_URL = 'http://localhost:3001';

async function apiFetch(path, options) {
  const res = await fetch(`${API_BASE_URL}${path}`, {
    headers: {
      'Content-Type': 'application/json',
      ...(options && options.headers ? options.headers : {}),
    },
    ...options,
  });

  if (!res.ok) {
    let detail = `Request failed (${res.status})`;
    try {
      const body = await res.json();
      detail = body && body.detail ? body.detail : detail;
    } catch (_) {
      // ignore
    }
    throw new Error(detail);
  }

  // 204/empty responses
  const text = await res.text();
  return text ? JSON.parse(text) : null;
}

// PUBLIC_INTERFACE
function App() {
  const [notes, setNotes] = useState([]);
  const [selectedId, setSelectedId] = useState(null);

  // Editor state
  const [isEditing, setIsEditing] = useState(false);
  const [draftTitle, setDraftTitle] = useState('');
  const [draftContent, setDraftContent] = useState('');

  const [status, setStatus] = useState({ type: 'idle', message: '' });

  const titleInputRef = useRef(null);

  const selectedNote = useMemo(
    () => notes.find((n) => n.id === selectedId) || null,
    [notes, selectedId]
  );

  const refreshNotes = async (keepSelectionId) => {
    const data = await apiFetch('/notes');
    setNotes(data || []);
    if (keepSelectionId != null) {
      setSelectedId(keepSelectionId);
      return;
    }
    // Ensure we have a selection when notes exist
    if ((data || []).length > 0) {
      setSelectedId((prev) => (prev != null ? prev : (data || [])[0].id));
    } else {
      setSelectedId(null);
    }
  };

  useEffect(() => {
    (async () => {
      try {
        setStatus({ type: 'loading', message: 'Loading notes…' });
        await refreshNotes();
        setStatus({ type: 'idle', message: '' });
      } catch (e) {
        setStatus({ type: 'error', message: e.message || 'Failed to load notes' });
      }
    })();
  }, []);

  useEffect(() => {
    // When selection changes and we're not editing, show current note in the viewer.
    if (!isEditing && selectedNote) {
      setDraftTitle(selectedNote.title);
      setDraftContent(selectedNote.content);
    }
    if (!isEditing && !selectedNote) {
      setDraftTitle('');
      setDraftContent('');
    }
  }, [selectedNote, isEditing]);

  useEffect(() => {
    if (isEditing && titleInputRef.current) {
      titleInputRef.current.focus();
      titleInputRef.current.select();
    }
  }, [isEditing]);

  const startNewNote = () => {
    setIsEditing(true);
    setSelectedId(null); // represent "new note"
    setDraftTitle('Untitled');
    setDraftContent('');
    setStatus({ type: 'idle', message: '' });
  };

  const startEditSelected = () => {
    if (!selectedNote) return;
    setIsEditing(true);
    setDraftTitle(selectedNote.title);
    setDraftContent(selectedNote.content);
  };

  const cancelEdit = () => {
    setIsEditing(false);
    if (selectedNote) {
      setDraftTitle(selectedNote.title);
      setDraftContent(selectedNote.content);
    } else {
      setDraftTitle('');
      setDraftContent('');
    }
  };

  const save = async () => {
    const title = (draftTitle || '').trim();
    if (!title) {
      setStatus({ type: 'error', message: 'Title cannot be empty.' });
      return;
    }

    try {
      setStatus({ type: 'loading', message: 'Saving…' });
      if (selectedId == null) {
        // create
        const created = await apiFetch('/notes', {
          method: 'POST',
          body: JSON.stringify({ title, content: draftContent || '' }),
        });
        await refreshNotes(created.id);
        setIsEditing(false);
      } else {
        // update
        await apiFetch(`/notes/${selectedId}`, {
          method: 'PUT',
          body: JSON.stringify({ title, content: draftContent || '' }),
        });
        await refreshNotes(selectedId);
        setIsEditing(false);
      }
      setStatus({ type: 'success', message: 'Saved.' });
      window.setTimeout(() => setStatus({ type: 'idle', message: '' }), 1200);
    } catch (e) {
      setStatus({ type: 'error', message: e.message || 'Save failed' });
    }
  };

  const deleteSelected = async () => {
    if (!selectedNote) return;
    const ok = window.confirm(`Delete "${selectedNote.title}"?`);
    if (!ok) return;

    try {
      setStatus({ type: 'loading', message: 'Deleting…' });
      await apiFetch(`/notes/${selectedNote.id}`, { method: 'DELETE' });
      await refreshNotes(null);
      setIsEditing(false);
      setStatus({ type: 'success', message: 'Deleted.' });
      window.setTimeout(() => setStatus({ type: 'idle', message: '' }), 1200);
    } catch (e) {
      setStatus({ type: 'error', message: e.message || 'Delete failed' });
    }
  };

  return (
    <div className="NotesApp">
      <header className="TopBar">
        <div className="TopBar-left">
          <div className="AppTitle">Simple Notes</div>
          <div className="AppSubtitle">Create, edit, and delete notes</div>
        </div>

        <div className="TopBar-right">
          <button className="Btn Btn-primary" onClick={startNewNote}>
            + New Note
          </button>
        </div>
      </header>

      <main className="Main">
        <aside className="Sidebar" aria-label="Notes list">
          <div className="SidebarHeader">
            <div className="SidebarTitle">Notes</div>
            <div className="SidebarCount">{notes.length}</div>
          </div>

          <div className="NotesList" role="list">
            {notes.length === 0 ? (
              <div className="EmptyState">
                <div className="EmptyTitle">No notes yet</div>
                <div className="EmptyText">Click “New Note” to create your first note.</div>
              </div>
            ) : (
              notes.map((n) => (
                <button
                  key={n.id}
                  className={`NoteListItem ${selectedId === n.id ? 'active' : ''}`}
                  onClick={() => {
                    setSelectedId(n.id);
                    setIsEditing(false);
                  }}
                  role="listitem"
                  title={n.title}
                >
                  <div className="NoteListTitle">{n.title}</div>
                </button>
              ))
            )}
          </div>
        </aside>

        <section className="Detail" aria-label="Note details">
          <div className="DetailHeader">
            <div className="DetailHeader-left">
              <div className="DetailTitle">
                {selectedId == null && isEditing ? 'New note' : selectedNote ? 'Note' : 'Select a note'}
              </div>
              {selectedNote && !isEditing ? (
                <div className="DetailMeta">Last updated: {new Date(selectedNote.updated_at).toLocaleString()}</div>
              ) : null}
            </div>

            <div className="DetailHeader-right">
              {!isEditing && selectedNote ? (
                <>
                  <button className="Btn Btn-success" onClick={startEditSelected}>
                    Edit
                  </button>
                  <button className="Btn Btn-danger" onClick={deleteSelected}>
                    Delete
                  </button>
                </>
              ) : null}

              {isEditing ? (
                <>
                  <button className="Btn Btn-primary" onClick={save}>
                    Save
                  </button>
                  <button className="Btn Btn-ghost" onClick={cancelEdit}>
                    Cancel
                  </button>
                </>
              ) : null}
            </div>
          </div>

          <div className="DetailBody">
            {status.type !== 'idle' ? (
              <div
                className={`Banner ${
                  status.type === 'error'
                    ? 'Banner-error'
                    : status.type === 'success'
                      ? 'Banner-success'
                      : 'Banner-info'
                }`}
                role={status.type === 'error' ? 'alert' : 'status'}
              >
                {status.message}
              </div>
            ) : null}

            {isEditing ? (
              <div className="Editor">
                <label className="Field">
                  <div className="FieldLabel">Title</div>
                  <input
                    ref={titleInputRef}
                    className="Input"
                    value={draftTitle}
                    onChange={(e) => setDraftTitle(e.target.value)}
                    placeholder="Title"
                  />
                </label>

                <label className="Field">
                  <div className="FieldLabel">Content</div>
                  <textarea
                    className="Textarea"
                    value={draftContent}
                    onChange={(e) => setDraftContent(e.target.value)}
                    placeholder="Write your note…"
                    rows={12}
                  />
                </label>
              </div>
            ) : selectedNote ? (
              <article className="Viewer">
                <h2 className="ViewerTitle">{selectedNote.title}</h2>
                <p className="ViewerContent">{selectedNote.content || '—'}</p>
              </article>
            ) : (
              <div className="EmptyDetail">
                <div className="EmptyTitle">Nothing selected</div>
                <div className="EmptyText">Choose a note from the list or create a new one.</div>
              </div>
            )}
          </div>
        </section>
      </main>
    </div>
  );
}

export default App;
