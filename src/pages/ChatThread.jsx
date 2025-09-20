import { useEffect, useState, useRef } from 'react';
import { useParams } from 'react-router-dom';
import { supabase } from '../supabase';

export default function ChatThread(){
  const { chatId } = useParams();
  const [session, setSession] = useState(null);
  const [chat, setChat] = useState(null);
  const [messages, setMessages] = useState(null);
  const [text, setText] = useState('');
  const [file, setFile] = useState(null);
  const [err, setErr] = useState('');
  const [busy, setBusy] = useState(false);
  const endRef = useRef(null);

  useEffect(() => {
    supabase.auth.getSession().then(({data}) => setSession(data.session));
  }, []);

  // Chat ophalen (RLS beschermt toegang)
  useEffect(() => {
    if (!chatId) return;
    supabase.from('chats').select('*').eq('id', chatId).maybeSingle()
      .then(({ data, error }) => {
        if (error) { setErr(error.message); return; }
        setChat(data);
      });
  }, [chatId]);

  // Berichten laden (en signed URL’s toevoegen)
  async function loadMessages(){
    const { data, error } = await supabase
      .from('messages')
      .select('*')
      .eq('chat_id', chatId)
      .order('created_at', { ascending: true });
    if (error) { console.error(error); setMessages([]); return; }

    const withUrls = await Promise.all((data || []).map(async (m) => {
      if (m.file?.path) {
        const { data: signed } = await supabase
          .storage
          .from('chats')
          .createSignedUrl(m.file.path, 60 * 60); // 1 uur
        if (signed?.signedUrl) {
          return { ...m, file: { ...m.file, signedUrl: signed.signedUrl } };
        }
      }
      return m;
    }));

    setMessages(withUrls);
    setTimeout(() => endRef.current?.scrollIntoView({ behavior: 'smooth' }), 50);
  }

  useEffect(() => { if (chatId) loadMessages(); }, [chatId]);

  if (!session) return <div style={{padding:20}}>Laden…</div>;
  if (!chat) return <div style={{padding:20}}>Chat laden…</div>;

  async function sendMessage(e){
    e?.preventDefault();
    if (!text && !file) return;
    setBusy(true); setErr('');

    try {
      let fileMeta = null;
      if (file) {
        const path = `${chatId}/${crypto.randomUUID()}-${file.name}`;
        const { error: upErr } = await supabase.storage.from('chats').upload(path, file);
        if (upErr) throw upErr;
        fileMeta = {
          name: file.name,
          path,
          type: file.type,
          size: file.size
        };
      }

      const payload = {
        chat_id: chatId,
        sender_id: session.user.id,
        text: text || null,
        file: fileMeta
      };

      const { error } = await supabase.from('messages').insert(payload);
      if (error) throw error;

      setText('');
      setFile(null);
      await loadMessages(); // handmatig verversen na versturen
    } catch (e) {
      setErr(e.message ?? String(e));
    } finally {
      setBusy(false);
    }
  }

  return (
    <div style={{maxWidth:800, margin:'20px auto', fontFamily:'system-ui', display:'flex', flexDirection:'column', height:'80vh'}}>
      <h2 style={{margin:'8px 0'}}>Chat</h2>

      <div style={{flex:1, overflowY:'auto', border:'1px solid #ddd', borderRadius:8, padding:12, background:'#fafafa'}}>
        {messages?.length ? messages.map(m => (
          <div key={m.id} style={{
            margin:'8px 0',
            display:'flex',
            flexDirection: session.user.id === m.sender_id ? 'row-reverse' : 'row',
            gap:8
          }}>
            <div style={{
              maxWidth:'70%',
              background: session.user.id === m.sender_id ? '#e8f0ff' : '#fff',
              border:'1px solid #ddd', borderRadius:8, padding:8
            }}>
              {m.text && <div style={{whiteSpace:'pre-wrap'}}>{m.text}</div>}
              {m.file && (
                <div style={{marginTop:6, fontSize:14}}>
                  📎 {m.file.name}{' '}
                  {m.file.signedUrl ? (
                    <a href={m.file.signedUrl} target="_blank" rel="noreferrer">Download</a>
                  ) : (
                    <span style={{color:'#999'}}>bestand</span>
                  )}
                </div>
              )}
              <div style={{fontSize:11, color:'#777', marginTop:4}}>
                {new Date(m.created_at).toLocaleString()}
              </div>
            </div>
          </div>
        )) : <div style={{color:'#666'}}>Nog geen berichten.</div>}
        <div ref={endRef} />
      </div>

      <form onSubmit={sendMessage} style={{display:'flex', gap:8, marginTop:10}}>
        <input
          value={text}
          onChange={e=>setText(e.target.value)}
          placeholder="Typ je bericht…"
          style={{flex:1, padding:10, border:'1px solid #ccc', borderRadius:6}}
        />
        <input
          type="file"
          onChange={e=>setFile(e.target.files[0] || null)}
          style={{maxWidth:220}}
        />
        <button disabled={busy}>{busy ? 'Versturen…' : 'Verstuur'}</button>
        <button type="button" onClick={loadMessages} style={{marginLeft:8}}>Verversen</button>
      </form>

      {err && <div style={{color:'crimson', marginTop:8}}>{err}</div>}
    </div>
  );
}