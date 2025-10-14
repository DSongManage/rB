import React, { useState } from 'react';
import { useDropzone } from 'react-dropzone';
import ReactQuill from 'react-quill';
import 'react-quill/dist/quill.snow.css';

type Props = {
  type: 'text'|'image'|'video';
  onReady: (payload: { title: string; file?: File; textHtml?: string; }) => void;
  registerSubmit?: (fn: ()=>void) => void;
  showNextButton?: boolean;
};

export default function CreateStep({ type, onReady, registerSubmit, showNextButton = true }: Props){
  const [title, setTitle] = useState('');
  const [textHtml, setTextHtml] = useState('');
  const [file, setFile] = useState<File|undefined>();
  const [msg, setMsg] = useState('');

  const onDrop = (accepted: File[]) => {
    if (accepted[0]) {
      if (accepted[0].size > 50 * 1024 * 1024) { setMsg('File exceeds 50MB limit'); return; }
      setFile(accepted[0]);
      setMsg('');
    }
  };
  const { getRootProps, getInputProps, isDragActive } = useDropzone({ onDrop });

  const next = () => {
    onReady({ title, file, textHtml });
  };

  React.useEffect(()=>{
    if (registerSubmit) {
      registerSubmit(()=> onReady({ title, file, textHtml }));
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [registerSubmit, title, file, textHtml]);

  return (
    <div style={{display:'grid', gap:12}}>
      <input placeholder="Title" value={title} onChange={(e)=> setTitle(e.target.value)} />
      {type === 'text' && (
        <ReactQuill theme="snow" value={textHtml} onChange={setTextHtml} placeholder="Start writing..." />
      )}
      {type !== 'text' && (
        <div {...getRootProps()} style={{padding:24, border:'2px dashed var(--panel-border)', borderRadius:12, textAlign:'center', background:'var(--panel)'}}>
          <input {...getInputProps()} />
          {isDragActive ? 'Drop files here' : (file ? file.name : 'Drag & drop or click to upload (50MB max)')}
        </div>
      )}
      <div style={{display:'flex', justifyContent:'space-between', alignItems:'center', gap:12}}>
        <div style={{fontSize:12, color:'#94a3b8'}}>{msg}</div>
        {showNextButton && (
          <button onClick={next} style={{background:'var(--accent)', color:'#111', border:'none', padding:'8px 12px', borderRadius:8, width:120}}>Next</button>
        )}
      </div>
    </div>
  );
}


