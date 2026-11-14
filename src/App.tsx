import {useEffect,useMemo,useRef,useState} from 'react';
import type {ChangeEvent,FormEvent} from 'react';
import {
 CATEGORIES,CATEGORY_STYLE,STATUS_LABELS,countPeriod,csvOfGoals,displayDate,downloadFile,
 initialStore,localDate,makeGoal,normalizeStore,progress,shiftDays,startPeriod,uid,valueAverage
} from './model';
import type {Goal,GoalStatus,HistoryEntry,Period,Priority,Store,Subtask,TrackerKind} from './model';
import {CLOUD_API,readCloud,writeCloud} from './cloud';
import './styles.css';

type Page='dashboard'|'all'|'categories'|'recurring'|'history'|'completed'|'settings';
type Filters={query:string;category:string;status:string;priority:string};
const KEY='personal-goals-dashboard-v2';
const LEGACY_KEY='personal-goals-dashboard-v1';
const emptyFilters:Filters={query:'',category:'',status:'',priority:''};
const NAV:{id:Page;icon:string;label:string}[]=[
 {id:'dashboard',icon:'⌂',label:'Dashboard'},
 {id:'all',icon:'◎',label:'All Goals'},
 {id:'categories',icon:'▤',label:'Categories'},
 {id:'recurring',icon:'↻',label:'Recurring'},
 {id:'history',icon:'▥',label:'Progress History'},
 {id:'completed',icon:'✓',label:'Completed'},
 {id:'settings',icon:'⚙',label:'Settings'},
];
const PAGE_TITLE:Record<Page,string>={dashboard:'Goals & Targets Dashboard',all:'All Goals',categories:'Goals by Category',recurring:'Recurring Goals',history:'Progress History',completed:'Completed Goals',settings:'Settings'};
function loadLocal():Store {
 try {
  for (const key of [KEY,LEGACY_KEY]) {
   const raw=localStorage.getItem(key);
   if (raw) {const parsed=normalizeStore(JSON.parse(raw));if (parsed) return parsed;}
  }
 } catch { /* In-memory fallback if browser storage is blocked. */ }
 return initialStore();
}
function activityText(goal:Goal):string {
 const t=goal.tracker;
 if (t.kind==='checklist') return `${goal.subtasks.filter(s=>s.done).length} of ${goal.subtasks.length} milestones`;
 if (t.kind==='recurring') return `${countPeriod(goal)} of ${t.target || '—'} this ${t.period==='daily'?'day':t.period==='weekly'?'week':'month'}`;
 if (t.kind==='number') {
  const val=t.dailyAverage ? valueAverage(goal) : t.current;
  return val===null?'No values recorded':`${val.toLocaleString()} / ${t.target ? t.target.toLocaleString():'set target'} ${t.unit}${t.dailyAverage?' (7-day recorded avg)':''}`;
 }
 return '';
}
function ProgressBar({pct,small=false}:{pct:number|null;small?:boolean}) {
 if (pct===null) return null;
 return <div className={`progress-track ${small?'small':''}`} role="progressbar" aria-valuemin={0} aria-valuemax={100} aria-valuenow={pct}>
  <div className="progress-fill" style={{width:`${pct}%`}} />
 </div>;
}
function GoalMini({goal,onSelect,onToggle,onEdit}:{goal:Goal;onSelect:(g:Goal)=>void;onToggle:(g:Goal)=>void;onEdit:(g:Goal)=>void}) {
 const pct=progress(goal);
 return <article className={`goal-mini ${goal.status==='completed'?'done':''}`}>
  <button className={`check-button ${goal.status==='completed'?'checked':''}`} onClick={()=>onToggle(goal)} aria-label={`Mark ${goal.title} ${goal.status==='completed'?'incomplete':'completed'}`}>{goal.status==='completed'?'✓':''}</button>
  <div className="goal-mini-main">
   <button className="goal-title-link" onClick={()=>onSelect(goal)}>{goal.title}</button>
   <div className="ministat"><span className={`status-pill s-${goal.status}`}>{STATUS_LABELS[goal.status]}</span>{goal.tracker.kind!=='none'&&<span className="mini-ratio">{activityText(goal)}</span>}</div>
   {pct!==null&&<div className="mini-progress"><ProgressBar pct={pct} small/><span>{pct}%</span></div>}
   {goal.dueDate&&<span className="mini-date">◷ {displayDate(goal.dueDate)}</span>}
  </div>
  <button className="more-button" onClick={()=>onEdit(goal)} title={`Edit ${goal.title}`} aria-label={`Edit ${goal.title}`}>⋯</button>
 </article>;
}
function CategoryGrid({goals,categories,onSelect,onToggle,onEdit}:{goals:Goal[];categories:string[];onSelect:(g:Goal)=>void;onToggle:(g:Goal)=>void;onEdit:(g:Goal)=>void}){
 return <div className="category-grid">{categories.filter(c=>goals.some(g=>g.category===c)).map(category=>{
  const list=goals.filter(g=>g.category===category);
  const meta=CATEGORY_STYLE[category]||{icon:'◈',tint:'violet'};
  return <section className="category-tile" key={category}>
   <header className={`category-tile-header tint-${meta.tint}`}><span className="category-title"><i>{meta.icon}</i>{category}</span><span className="count-chip">{list.length} {list.length===1?'goal':'goals'}</span></header>
   <div>{list.map(g=><GoalMini key={g.id} goal={g} onSelect={onSelect} onToggle={onToggle} onEdit={onEdit}/>)}</div>
  </section>;
 })}</div>;
}
function WeekDots({goal,onToggle}:{goal:Goal;onToggle:(g:Goal,date:string)=>void}){
 const start=startPeriod('weekly');
 const days=['Mon','Tue','Wed','Thu','Fri','Sat','Sun'];
 return <div className="week-dots">{days.map((name,i)=>{
  const day=shiftDays(start,i);const checked=goal.tracker.events.includes(day);const future=day>localDate();
  return <button key={name} type="button" className={`day-dot ${checked?'hit':''}`} title={`${name} ${day}`} disabled={future} onClick={()=>onToggle(goal,day)}><span>{checked?'✓':''}</span><small>{name}</small></button>;
 })}</div>;
}
function StepsPreview({goal}:{goal:Goal}){
 const days=Array.from({length:7},(_,i)=>shiftDays(startPeriod('weekly'),i));
 const maximum=Math.max(goal.tracker.target, ...days.map(d=>goal.tracker.values[d]||0),1);
 return <div className="step-wrap"><div className="step-bars">{days.map((date,i)=><div className="step-col" key={date}><div className="step-bar" style={{height:`${Math.max(5,Math.round((goal.tracker.values[date]||0)/maximum*100))}%`,opacity:goal.tracker.values[date]===undefined?.18:1}} title={`${date}: ${goal.tracker.values[date]??'not recorded'}`}/><small>{['M','T','W','T','F','S','S'][i]}</small></div>)}</div><span className="step-average">{valueAverage(goal)?.toLocaleString()??'—'}<small>7-day avg*</small></span></div>;
}
function RecurringRow({goal,onToggleDay,onLogValue,onEdit}:{goal:Goal;onToggleDay:(g:Goal,date:string)=>void;onLogValue:(g:Goal,value:number)=>void;onEdit:(g:Goal)=>void}){
 const [input,setInput]=useState('');
 const isValue=goal.tracker.kind==='number'&&goal.tracker.dailyAverage;
 const isRecurring=goal.tracker.kind==='recurring';
 return <div className="recurring-row">
  <div className="recurring-icon">{isValue?'↟':goal.tracker.period==='monthly'?'♙':'✦'}</div>
  <div className="recurring-body"><div className="recurring-top"><strong>{goal.title}</strong><button className="more-button" onClick={()=>onEdit(goal)} aria-label={`Edit ${goal.title}`}>⋯</button></div>
   {isRecurring&&<><div className="muted-caption">This {goal.tracker.period}: {countPeriod(goal)} / {goal.tracker.target||'set target'} completed</div>
    {goal.tracker.period==='weekly'?<WeekDots goal={goal} onToggle={onToggleDay}/>:<div className="row-inline"><ProgressBar pct={progress(goal)} small/><button className="small-action" onClick={()=>onToggleDay(goal,localDate())}>{goal.tracker.events.includes(localDate())?'Undo today':'+ Log today'}</button></div>}
   </>}
   {isValue&&<><StepsPreview goal={goal}/><form className="tiny-log" onSubmit={e=>{e.preventDefault();const val=Number(input);if(input!==''&&Number.isFinite(val)&&val>=0){onLogValue(goal,val);setInput('');}}}><input aria-label="Today's steps" type="number" min="0" step="1" value={input} onChange={e=>setInput(e.target.value)} placeholder="Today's steps"/><button type="submit">Save</button></form><small className="muted-caption">*Average of recorded days in the last 7 days</small></>}
  </div>
 </div>;
}
function TrendChart({history}:{history:HistoryEntry[]}){
 const weeks=Array.from({length:8},(_,i)=>shiftDays(startPeriod('weekly'),(i-7)*7));
 const values=weeks.map((start)=>{
  const end=shiftDays(start,6);
  const matching=history.filter(h=>h.at.slice(0,10)>=start&&h.at.slice(0,10)<=end&&h.progress!==null);
  const latest=new Map<string,number>();
  matching.forEach(h=>{if(h.progress!==null)latest.set(h.goalId,h.progress);});
  if (!latest.size) return null;
  return Math.round([...latest.values()].reduce((a,b)=>a+b,0)/latest.size);
 });
 const points=values.map((v,i)=>v===null?null:{x:38+(i*42),y:151-v*1.22,v,i}).filter((p):p is {x:number;y:number;v:number;i:number}=>p!==null);
 const segments:typeof points[]=[];
 let segment:typeof points=[];
 values.forEach((value,i)=>{
  if(value===null){if(segment.length)segments.push(segment);segment=[];}
  else segment.push({x:38+i*42,y:151-value*1.22,v:value,i});
 });if(segment.length)segments.push(segment);
 return <div className="history-chart"><svg viewBox="0 0 368 191" aria-label="Weekly average of recorded goal progress" role="img">
  {[0,25,50,75,100].map(v=><g key={v}><line x1="38" x2="356" y1={151-v*1.22} y2={151-v*1.22} stroke="#e7e9f1"/><text x="28" y={155-v*1.22} textAnchor="end" fill="#8d90a6" fontSize="10">{v}%</text></g>)}
  {weeks.map((week,i)=><text key={week} x={38+i*42} y="177" textAnchor="middle" fontSize="10" fill="#8d90a6">W{i+1}</text>)}
  {segments.map((s,i)=><polyline key={i} points={s.map(p=>`${p.x},${p.y}`).join(' ')} fill="none" stroke="#854cde" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"/>)}
  {points.map(p=><circle key={p.i} cx={p.x} cy={p.y} r="4" fill="white" stroke="#854cde" strokeWidth="2.5"/>)}
 </svg>
 {points.length?<p className="trend-caption">Recorded weekly averages only · {points.length} {points.length===1?'week':'weeks'} with updates</p>:<div className="trend-placeholder">Your chart will appear after you start updating goals. No example data has been invented.</div>}
 </div>;
}
function Detail({goal,onEdit,onToggle,onToggleSubtask,onFocus}:{goal:Goal;onEdit:(g:Goal)=>void;onToggle:(g:Goal)=>void;onToggleSubtask:(g:Goal,id:string)=>void;onFocus:(g:Goal)=>void}){
 const pct=progress(goal);
 return <section className="detail-panel">
  <div className="detail-heading"><div><span className="section-glyph">◎</span><h2>{goal.title}</h2><span className={`status-pill s-${goal.status}`}>{STATUS_LABELS[goal.status]}</span></div><div className="detail-controls"><button className="subtle-btn" onClick={()=>onFocus(goal)}>{goal.focus?'★ Focus':'☆ Add to Focus'}</button><button className="subtle-btn" onClick={()=>onEdit(goal)}>✎ Edit</button><button className="primary-button small" onClick={()=>onEdit(goal)}>＋ Add Subtask</button></div></div>
  <div className="detail-meta"><div className="detail-progress"><ProgressBar pct={pct}/><strong>{pct===null?'No tracker':`${pct}%`}</strong></div><span>◷ {displayDate(goal.dueDate)}</span><span>▤ {goal.category}</span><span>⚑ {goal.priority}</span></div>
  <div className="detail-bottom"><div className="subtask-box"><h3>Subtasks ({goal.subtasks.filter(s=>s.done).length}/{goal.subtasks.length})</h3>{goal.subtasks.length?goal.subtasks.map(s=><label key={s.id} className="subtask-line"><input type="checkbox" checked={s.done} onChange={()=>onToggleSubtask(goal,s.id)}/><span className={s.done?'crossed':''}>{s.title}</span></label>):<p className="placeholder">No subtasks yet. Use Edit to add some.</p>}</div>
   <div className="notes-box"><h3>▤ Notes</h3><p>{goal.description||'No notes yet. Add a note using Edit.'}</p><button className="text-link" onClick={()=>onToggle(goal)}>{goal.status==='completed'?'↶ Reopen goal':'✓ Mark goal completed'}</button></div>
  </div>
 </section>;
}
function Editor({source,categories,onSave,onDelete,onAddCategory,onCancel}:{source:Goal;categories:string[];onSave:(g:Goal)=>void;onDelete:(id:string)=>void;onAddCategory:(name:string)=>void;onCancel:()=>void}){
 const [draft,setDraft]=useState<Goal>(source);
 const [subInput,setSubInput]=useState('');
 const [catInput,setCatInput]=useState('');
 const [addCat,setAddCat]=useState(false);
 const isExisting=!!source.title;
 useEffect(()=>{setDraft(source);setSubInput('');setAddCat(false);},[source]);
 const patch=(p:Partial<Goal>)=>setDraft(old=>({...old,...p}));
 const patchTracker=(p:Partial<Goal['tracker']>)=>setDraft(old=>({...old,tracker:{...old.tracker,...p}}));
 const addSubtask=()=>{if(!subInput.trim())return;patch({subtasks:[...draft.subtasks,{id:uid(),title:subInput.trim(),done:false}]});setSubInput('');};
 const submit=(event:FormEvent)=>{event.preventDefault();if(!draft.title.trim())return;onSave({...draft,title:draft.title.trim(),description:draft.description.trim()});};
 return <section className="editor-card" id="goal-editor"><div className="editor-header"><h2><span className="section-glyph">＋</span> {isExisting?'Edit Goal':'Create Goal'}</h2>{isExisting&&<button className="x-button" onClick={onCancel} title="Cancel editing">✕</button>}</div>
  <form className="editor-form" onSubmit={submit}>
   <label className="field"><span>Goal title <b>*</b></span><input required value={draft.title} onChange={e=>patch({title:e.target.value})} placeholder="e.g. Run a half marathon"/></label>
   <label className="field"><span>Category</span><select value={draft.category} onChange={e=>patch({category:e.target.value})}>{categories.map(c=><option key={c}>{c}</option>)}</select></label>
   <button className="text-link" type="button" onClick={()=>setAddCat(v=>!v)}>+ New category</button>
   {addCat&&<div className="inline-form"><input value={catInput} onChange={e=>setCatInput(e.target.value)} placeholder="New category name"/><button type="button" onClick={()=>{const name=catInput.trim();if(name){onAddCategory(name);patch({category:name});setAddCat(false);setCatInput('');}}}>Add</button></div>}
   <label className="field"><span>Description / notes</span><textarea rows={3} value={draft.description} onChange={e=>patch({description:e.target.value})} placeholder="What would achieving this mean to you?"/></label>
   <div className="field"><span>Progress type</span><div className="progress-types">{([['none','✓','None'],['percentage','%','Percent'],['checklist','☷','Checklist'],['number','#','Numeric'],['recurring','↻','Recurring']] as [TrackerKind,string,string][]).map(([kind,icon,label])=><button key={kind} type="button" className={draft.tracker.kind===kind?'selected':''} onClick={()=>patchTracker({kind})}><strong>{icon}</strong><small>{label}</small></button>)}</div></div>
   {draft.tracker.kind==='percentage'&&<label className="field"><span>Current progress: {draft.tracker.percent}%</span><input type="range" min={0} max={100} value={draft.tracker.percent} onChange={e=>patchTracker({percent:Number(e.target.value)})}/></label>}
   {draft.tracker.kind==='number'&&<><div className="field-pair"><label className="field"><span>Current amount</span><input type="number" min="0" value={draft.tracker.current} onChange={e=>patchTracker({current:Math.max(0,Number(e.target.value))})}/></label><label className="field"><span>Target amount</span><input type="number" min="0" value={draft.tracker.target} onChange={e=>patchTracker({target:Math.max(0,Number(e.target.value))})}/></label></div><label className="field"><span>Unit</span><input value={draft.tracker.unit} placeholder="AUD, steps, km..." onChange={e=>patchTracker({unit:e.target.value})}/></label><label className="check-label"><input type="checkbox" checked={draft.tracker.dailyAverage} onChange={e=>patchTracker({dailyAverage:e.target.checked})}/> Daily entries / seven-day average (for steps)</label></>}
   {draft.tracker.kind==='recurring'&&<div className="field-pair"><label className="field"><span>Repeat period</span><select value={draft.tracker.period} onChange={e=>patchTracker({period:e.target.value as Period})}><option value="daily">Daily</option><option value="weekly">Weekly</option><option value="monthly">Monthly</option></select></label><label className="field"><span>Times per period</span><input type="number" min={1} max={366} value={draft.tracker.target||1} onChange={e=>patchTracker({target:Math.max(1,Number(e.target.value))})}/></label></div>}
   <div className="field"><span>Subtasks / milestones</span>{draft.subtasks.map(s=><div className="editor-subtask" key={s.id}><input type="checkbox" checked={s.done} onChange={()=>patch({subtasks:draft.subtasks.map(item=>item.id===s.id?{...item,done:!item.done}:item)})}/><input aria-label="Subtask title" value={s.title} onChange={e=>patch({subtasks:draft.subtasks.map(item=>item.id===s.id?{...item,title:e.target.value}:item)})}/><button type="button" onClick={()=>patch({subtasks:draft.subtasks.filter(item=>item.id!==s.id)})} aria-label="Remove subtask">✕</button></div>)}<div className="inline-form"><input placeholder="Add a subtask" value={subInput} onChange={e=>setSubInput(e.target.value)} onKeyDown={e=>{if(e.key==='Enter'){e.preventDefault();addSubtask();}}}/><button type="button" onClick={addSubtask}>Add</button></div></div>
   <div className="field-pair"><label className="field"><span>Target date</span><input type="date" value={draft.dueDate} onChange={e=>patch({dueDate:e.target.value})}/></label><label className="field"><span>Priority</span><select value={draft.priority} onChange={e=>patch({priority:e.target.value as Priority})}><option>Low</option><option>Medium</option><option>High</option></select></label></div>
   <label className="field"><span>Status</span><select value={draft.status} onChange={e=>patch({status:e.target.value as GoalStatus})}>{Object.entries(STATUS_LABELS).map(([k,v])=><option key={k} value={k}>{v}</option>)}</select></label>
   <label className="check-label"><input type="checkbox" checked={draft.focus} onChange={e=>patch({focus:e.target.checked})}/> Show in This Week's Focus</label>
   <p className="editor-hint">Recurring counts reset with each new period; previous check-ins are preserved.</p>
   <button className="primary-button full" type="submit">{isExisting?'Save Changes':'＋ Create Goal'}</button>
   {isExisting&&<button type="button" className="delete-btn" onClick={()=>{if(window.confirm(`Delete “${draft.title}”?`))onDelete(draft.id);}}>Delete this goal</button>}
  </form>
 </section>;
}
function Settings({data,onImport,onAddCategory,onRename,onDeleteCategory,cloudState}:{data:Store;onImport:(v:unknown)=>void;onAddCategory:(name:string)=>void;onRename:(oldName:string,newName:string)=>void;onDeleteCategory:(name:string)=>void;cloudState:string}){
 const [newCat,setNewCat]=useState('');
 const fileChange=async(e:ChangeEvent<HTMLInputElement>)=>{
  const file=e.target.files?.[0];if(!file)return;
  try {const value:unknown=JSON.parse(await file.text()); const store=normalizeStore(value);if(!store)throw Error('Invalid');if(window.confirm('Replace all currently stored goals with this backup? Export a backup first if needed.'))onImport(store);} catch {window.alert('That is not a valid goals backup.');}
  e.target.value='';
 };
 return <div className="settings-grid"><section className="settings-card"><h2>Backup & Restore</h2><p>Export all goals, subtasks and progress history as JSON. A CSV export includes goal summaries for spreadsheets.</p><div className="button-row"><button className="primary-button" onClick={()=>downloadFile(`my-goals-${localDate()}.json`,JSON.stringify(data,null,2),'application/json')}>↓ Export JSON</button><button className="subtle-btn" onClick={()=>downloadFile(`my-goals-${localDate()}.csv`,csvOfGoals(data.goals),'text/csv;charset=utf-8')}>↓ Export CSV</button></div><label className="upload-label">Import JSON Backup<input type="file" accept=".json,application/json" onChange={fileChange}/></label><p className="hint">Import replaces current data. CSV is for viewing or reporting, not full restore.</p></section>
  <section className="settings-card"><h2>Categories</h2><p>Rename categories without losing their goals.</p>{data.categories.map(c=><CategorySetting key={c} value={c} canDelete={!data.goals.some(g=>g.category===c)} onRename={onRename} onDelete={onDeleteCategory}/>)}<div className="inline-form"><input value={newCat} placeholder="New category" onChange={e=>setNewCat(e.target.value)}/><button onClick={()=>{if(newCat.trim()){onAddCategory(newCat);setNewCat('');}}}>Add</button></div></section>
  <section className="settings-card"><h2>Storage & Privacy</h2><p><strong>{CLOUD_API?'Cloud synchronisation configured':'Local-only demo mode'}</strong></p><p>{cloudState}</p><p>Protect your published site and its API with sign-in access controls. Do not place passwords or API secrets in goal notes or frontend environment variables.</p><p className="hint">A cloud backend example is included in the project under <code>cloudflare/</code>. ChatGPT Sites database integration needs to be wired into that platform's supported server-side APIs when you publish.</p></section>
 </div>;
}
function CategorySetting({value,canDelete,onRename,onDelete}:{value:string;canDelete:boolean;onRename:(oldName:string,newName:string)=>void;onDelete:(name:string)=>void}) {
 const [name,setName]=useState(value);
 useEffect(()=>setName(value),[value]);
 return <div className="category-setting"><input aria-label={`Rename ${value}`} value={name} onChange={e=>setName(e.target.value)}/><button className="subtle-btn" onClick={()=>onRename(value,name)}>Rename</button>{canDelete&&<button className="delete-small" onClick={()=>onDelete(value)}>×</button>}</div>;
}
export default function App(){
 const [data,setData]=useState<Store>(loadLocal);
 const [page,setPage]=useState<Page>('dashboard');
 const [filters,setFilters]=useState<Filters>(emptyFilters);
 const [editing,setEditing]=useState<Goal>(makeGoal());
 const [selected,setSelected]=useState<string|null>(null);
 const [localError,setLocalError]=useState(false);
 const [cloudReady,setCloudReady]=useState(!CLOUD_API);
 const [cloudState,setCloudState]=useState(CLOUD_API?'Connecting…':'Browser local storage · no cloud sync');
 const savingQueue=useRef<Promise<void>>(Promise.resolve());
 useEffect(()=>{
  if(!CLOUD_API)return;
  let cancelled=false;
  readCloud().then(remote=>{
   if(cancelled)return;
   const normalized=remote===null?null:normalizeStore(remote);
   if(remote!==null&&!normalized)throw Error('Cloud database has an invalid data format');
   if(normalized)setData(normalized);
   setCloudReady(true);setCloudState('Cloud connected · changes will sync');
  }).catch(error=>{if(!cancelled){setCloudReady(false);setCloudState(`Cloud unavailable · changes are local only: ${String(error)}`);}});
  return()=>{cancelled=true;};
 },[]);
 useEffect(()=>{
  try{localStorage.setItem(KEY,JSON.stringify(data));setLocalError(false);}catch{setLocalError(true);}
  if(!CLOUD_API||!cloudReady)return;
  const timer=window.setTimeout(()=>{
   const payload=data;
   savingQueue.current=savingQueue.current.catch(()=>undefined).then(async()=>{
    try{await writeCloud(payload);setCloudState('Saved to cloud');}
    catch(error){setCloudState(`Cloud save failed (local copy retained): ${String(error)}`);}
   });
  },750);
  return()=>clearTimeout(timer);
 },[data,cloudReady]);
 const updateGoal=(goal:Goal,detail='Goal updated')=>{
  setData(old=>{
   const previous=old.goals.find(g=>g.id===goal.id);
   const updated={...goal,updatedAt:new Date().toISOString(),completedAt:goal.status==='completed'?(goal.completedAt||new Date().toISOString()):''};
   const entry:HistoryEntry={id:uid(),goalId:updated.id,goalTitle:updated.title,at:new Date().toISOString(),progress:progress(updated),detail:previous?detail:'Goal created'};
   return {...old,goals:previous?old.goals.map(g=>g.id===updated.id?updated:g):[updated,...old.goals],history:[...old.history,entry].slice(-3000)};
  });
  setSelected(goal.id);
 };
 const removeGoal=(id:string)=>{setData(old=>({...old,goals:old.goals.filter(g=>g.id!==id),history:old.history.filter(h=>h.goalId!==id)}));setEditing(makeGoal(data.categories[0]));if(selected===id)setSelected(null);};
 const toggleComplete=(g:Goal)=>updateGoal({...g,status:g.status==='completed'?'in-progress':'completed'},g.status==='completed'?'Goal reopened':'Goal completed');
 const toggleSubtask=(g:Goal,id:string)=>{
  const subtasks=g.subtasks.map(s=>s.id===id?{...s,done:!s.done}:s);
  updateGoal({...g,subtasks,status:g.status==='not-started'?'in-progress':g.status},'Subtask updated');
 };
 const toggleDay=(g:Goal,date:string)=>{
  if(date>localDate())return;
  const events=g.tracker.events.includes(date)?g.tracker.events.filter(d=>d!==date):[...g.tracker.events,date];
  updateGoal({...g,tracker:{...g.tracker,events},status:g.status==='not-started'?'in-progress':g.status},`Recurring check-in ${events.includes(date)?'logged':'removed'} (${date})`);
 };
 const logValue=(g:Goal,value:number)=>{
  updateGoal({...g,tracker:{...g.tracker,values:{...g.tracker.values,[localDate()]:value}},status:g.status==='not-started'?'in-progress':g.status},`Daily value recorded: ${value} ${g.tracker.unit}`);
 };
 const addCategory=(name:string)=>{const n=name.trim();if(n)setData(old=>({...old,categories:old.categories.includes(n)?old.categories:[...old.categories,n]}));};
 const renameCategory=(from:string,to:string)=>{const n=to.trim();if(!n||n===from||data.categories.includes(n))return;setData(old=>({...old,categories:old.categories.map(c=>c===from?n:c),goals:old.goals.map(g=>g.category===from?{...g,category:n}:g)}));};
 const list=useMemo(()=>data.goals.filter(g=>{
  if(page==='completed'&&g.status!=='completed')return false;
  if(page==='recurring'&&g.tracker.kind!=='recurring'&&!(g.tracker.kind==='number'&&g.tracker.dailyAverage))return false;
  if(filters.category&&g.category!==filters.category)return false;
  if(filters.status&&g.status!==filters.status)return false;
  if(filters.priority&&g.priority!==filters.priority)return false;
  const q=filters.query.trim().toLowerCase();return !q||`${g.title} ${g.description} ${g.category} ${g.subtasks.map(s=>s.title).join(' ')}`.toLowerCase().includes(q);
 }),[data.goals,filters,page]);
 const focus=data.goals.filter(g=>g.focus&&g.status!=='completed').slice(0,5);
 const recurring=data.goals.filter(g=>g.tracker.kind==='recurring'||(g.tracker.kind==='number'&&g.tracker.dailyAverage));
 const currentDetail=(data.goals.find(g=>g.id===selected)||data.goals.find(g=>g.title.includes('diploma'))||data.goals[0]);
 const total=data.goals.length;
 const completed=data.goals.filter(g=>g.status==='completed').length;
 const inProgress=data.goals.filter(g=>g.status==='in-progress').length;
 const summary=[['◎','Total Goals',total,'purple'],['▷','In Progress',inProgress,'blue'],['✓','Completed',completed,'green'],['↻','Recurring Goals',recurring.length,'violet'],['ϟ','Focus This Week',focus.length,'orange']];
 const edit=(g:Goal)=>{setEditing(g);setSelected(g.id);document.getElementById('goal-editor')?.scrollIntoView({behavior:'smooth',block:'nearest'});};
 const create=()=>{setEditing(makeGoal(data.categories[0]));document.getElementById('goal-editor')?.scrollIntoView({behavior:'smooth',block:'nearest'});};
 const select=(g:Goal)=>{setSelected(g.id);if(page==='dashboard')document.getElementById('goal-detail')?.scrollIntoView({behavior:'smooth',block:'nearest'});};
 return <div className="app-shell">
  <aside className="sidebar"><div className="brand"><div className="brand-mark">▲</div><b>My Goals</b></div><nav aria-label="Main navigation">{NAV.map(n=><button key={n.id} className={`nav-link ${page===n.id?'active':''}`} onClick={()=>{setPage(n.id);setFilters(emptyFilters);}}><span>{n.icon}</span>{n.label}</button>)}</nav><div className="inspiration"><span className="mountain">⛰</span><strong>Small steps,<br/>real progress</strong></div></aside>
  <main className="main-area"><header className="topbar"><div><div className="title-line"><h1>{PAGE_TITLE[page]}</h1><span className="private-tag">♙ Private</span></div><p>Your personal space to plan, track and achieve what matters.</p></div><div className="top-actions"><button className="subtle-btn" onClick={()=>downloadFile(`my-goals-${localDate()}.json`,JSON.stringify(data,null,2),'application/json')}>↓ Export Backup</button><button className="primary-button" onClick={create}>＋ Create Goal</button></div></header>
  {localError&&<div className="warning">Browser storage is blocked or full. Export a backup before closing this tab.</div>}
  {CLOUD_API&&cloudState.toLowerCase().includes('failed')&&<div className="warning">{cloudState}</div>}
  {page!=='settings'&&<><section className="summary-row">{summary.map(([icon,label,val,tint])=><article className={`summary-card sum-${tint}`} key={String(label)}><div className="summary-icon">{icon}</div><div><small>{label}</small><strong>{val}</strong></div></article>)}</section>
   <section className="filter-row"><label className="searchbox"><span>⌕</span><input value={filters.query} onChange={e=>setFilters(f=>({...f,query:e.target.value}))} placeholder="Search goals, e.g. diploma, workout, savings…"/></label><select aria-label="Filter category" value={filters.category} onChange={e=>setFilters(f=>({...f,category:e.target.value}))}><option value="">All Categories</option>{data.categories.map(c=><option key={c}>{c}</option>)}</select><select aria-label="Filter status" value={filters.status} onChange={e=>setFilters(f=>({...f,status:e.target.value}))}><option value="">All Statuses</option>{Object.entries(STATUS_LABELS).map(([k,v])=><option key={k} value={k}>{v}</option>)}</select><select aria-label="Filter priority" value={filters.priority} onChange={e=>setFilters(f=>({...f,priority:e.target.value}))}><option value="">All Priorities</option><option>Low</option><option>Medium</option><option>High</option></select></section>
  </>}
  {page==='settings'?<Settings data={data} onImport={value=>{const store=normalizeStore(value);if(store){setData(store);setSelected(null);setEditing(makeGoal(store.categories[0]));}}} onAddCategory={addCategory} onRename={renameCategory} onDeleteCategory={name=>setData(old=>({...old,categories:old.categories.filter(c=>c!==name)}))} cloudState={cloudState}/>:<>
   {page==='dashboard'&&<section className="overview-grid">
    <article className="panel-card focus-card"><header className="panel-header"><h2><span className="section-glyph">◎</span> This Week's Focus</h2><span className="count-chip">{focus.length} goals</span></header><div className="focus-list">{focus.length?focus.map(g=><button key={g.id} className="focus-row" onClick={()=>select(g)}><span className="focus-ring"/><div><strong>{g.title}</strong><ProgressBar pct={progress(g)} small/></div><b>{progress(g)===null?'—':`${progress(g)}%`}</b></button>):<p className="placeholder">Pick goals using the ☆ Focus control.</p>}</div></article>
    <article className="panel-card recurring-card"><header className="panel-header"><h2><span className="section-glyph">↻</span> Recurring Goals</h2></header>{recurring.length?recurring.slice(0,3).map(g=><RecurringRow key={g.id} goal={g} onToggleDay={toggleDay} onLogValue={logValue} onEdit={edit}/>):<p className="placeholder">Add a recurring goal to start tracking habits.</p>}</article>
    <article className="panel-card chart-card"><header className="panel-header"><h2><span className="section-glyph">▥</span> Progress History</h2><button className="chart-filter" onClick={()=>setPage('history')}>Last 8 weeks ⌄</button></header><TrendChart history={data.history}/></article>
   </section>}
   <section className="lower-grid"><div className="lower-main">
    {page==='history'?<><div className="section-head"><h2>Weekly Progress History</h2><span>{data.history.length} recorded updates</span></div><div className="panel-card history-big"><TrendChart history={data.history}/></div><div className="activity-log"><h2>Recent activity</h2>{data.history.length?data.history.slice().reverse().slice(0,40).map(item=><div className="activity-item" key={item.id}><span>◎</span><div><strong>{item.goalTitle}</strong><p>{item.detail} · {new Date(item.at).toLocaleString('en-AU')}</p></div><b>{item.progress===null?'—':`${item.progress}%`}</b></div>):<p className="placeholder">Your completed actions and progress updates will appear here.</p>}</div></>:page==='recurring'?<><div className="section-head"><h2>Recurring Goals</h2><span>{list.length} habits</span></div><div className="recurring-list">{list.map(g=><RecurringRow key={g.id} goal={g} onToggleDay={toggleDay} onLogValue={logValue} onEdit={edit}/>)}</div></>:<>
     <div className="section-head"><h2><span className="section-glyph">▤</span> {page==='completed'?'Completed Goals':page==='all'?'All Goals':'Goals by Category'}</h2><span>{data.categories.length} categories · {list.length} goals</span></div>
     {list.length?<CategoryGrid goals={list} categories={data.categories} onSelect={select} onToggle={toggleComplete} onEdit={edit}/>:<p className="empty-block">No goals match these filters. Try removing a filter or creating another goal.</p>}
     {currentDetail&&page!=='completed'&&<div id="goal-detail"><Detail goal={currentDetail} onEdit={edit} onToggle={toggleComplete} onToggleSubtask={toggleSubtask} onFocus={g=>updateGoal({...g,focus:!g.focus},'Weekly focus changed')}/></div>}
    </>}
   </div><aside className="right-column"><Editor key={editing.id} source={editing} categories={data.categories} onSave={g=>{updateGoal(g);setEditing(makeGoal(data.categories[0]));}} onDelete={removeGoal} onAddCategory={addCategory} onCancel={()=>setEditing(makeGoal(data.categories[0]))}/></aside></section>
  </>}
  <footer className="site-footer">Personal dashboard starter · Version 2 · {CLOUD_API?'Cloud API configured':'Local demo mode'} · No Site published</footer>
  </main>
 </div>;
}
