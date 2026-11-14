export type GoalStatus = 'not-started' | 'in-progress' | 'on-hold' | 'completed';
export type Priority = 'Low' | 'Medium' | 'High';
export type Period = 'daily' | 'weekly' | 'monthly';
export type TrackerKind = 'none' | 'checklist' | 'percentage' | 'number' | 'recurring';

export type Tracker = {
  kind: TrackerKind;
  percent: number;
  current: number;
  target: number;
  unit: string;
  period: Period;
  events: string[];
  values: Record<string, number>;
  dailyAverage: boolean;
};
export type Subtask = { id: string; title: string; done: boolean };
export type Goal = {
  id: string;
  title: string;
  description: string;
  category: string;
  priority: Priority;
  status: GoalStatus;
  focus: boolean;
  dueDate: string;
  tracker: Tracker;
  subtasks: Subtask[];
  createdAt: string;
  updatedAt: string;
  completedAt: string;
};
export type HistoryEntry = {
  id: string;
  goalId: string;
  goalTitle: string;
  at: string;
  progress: number | null;
  detail: string;
};
export type Store = { version: 2; goals: Goal[]; categories: string[]; history: HistoryEntry[] };
export const CATEGORIES = ['Career & Learning','Health & Fitness','Finances & Savings','Social & Relationships','Lifestyle & Hobbies','Big Plans'];
export const CATEGORY_STYLE: Record<string, { icon: string; tint: string }> = {
  'Career & Learning': { icon: '▣', tint: 'sky' },
  'Health & Fitness': { icon: '♡', tint: 'mint' },
  'Finances & Savings': { icon: '♧', tint: 'peach' },
  'Social & Relationships': { icon: '♧', tint: 'pink' },
  'Lifestyle & Hobbies': { icon: '▣', tint: 'violet' },
  'Big Plans': { icon: '♢', tint: 'aqua' },
};
export const STATUS_LABELS: Record<GoalStatus, string> = {
  'not-started': 'Not Started', 'in-progress': 'In Progress', 'on-hold': 'On Hold', 'completed': 'Completed'
};
export const uid = (): string => typeof crypto !== 'undefined' && 'randomUUID' in crypto ? crypto.randomUUID() : `${Date.now()}-${Math.random().toString(36).slice(2)}`;
export const localDate = (d = new Date()): string => `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;
export function shiftDays(day: string, n: number): string {
  const date = new Date(`${day}T12:00:00`);
  date.setDate(date.getDate()+n);
  return localDate(date);
}
export function startPeriod(period: Period, anchor = localDate()): string {
  const d = new Date(`${anchor}T12:00:00`);
  if (period === 'weekly') { const dow = (d.getDay()+6)%7; d.setDate(d.getDate()-dow); }
  if (period === 'monthly') d.setDate(1);
  return localDate(d);
}
export function countPeriod(goal: Goal, anchor = localDate()): number {
  const start = startPeriod(goal.tracker.period, anchor);
  const end = goal.tracker.period === 'daily' ? start : goal.tracker.period === 'weekly' ? shiftDays(start,6) : shiftDays(startPeriod('monthly', shiftDays(start,32)),-1);
  return goal.tracker.events.filter((date) => date >= start && date <= end).length;
}
export function valueAverage(goal: Goal, lastDays = 7): number | null {
  const start = shiftDays(localDate(), -(lastDays-1));
  const values = Object.entries(goal.tracker.values).filter(([date]) => date >= start && date <= localDate()).map(([,value]) => value);
  return values.length ? Math.round(values.reduce((a,b)=>a+b,0)/values.length) : null;
}
export function progress(goal: Goal): number | null {
  const t = goal.tracker;
  if (goal.status === 'completed') return 100;
  if (t.kind === 'none') return null;
  if (t.kind === 'percentage') return Math.min(100,Math.max(0,Math.round(t.percent)));
  if (t.kind === 'checklist') return goal.subtasks.length ? Math.round(goal.subtasks.filter(s=>s.done).length/goal.subtasks.length*100) : null;
  if (t.kind === 'number') { const v = t.dailyAverage ? valueAverage(goal) : t.current; return t.target > 0 && v !== null ? Math.min(100,Math.round(v / t.target * 100)) : null; }
  return t.target > 0 ? Math.min(100,Math.round(countPeriod(goal)/t.target*100)) : null;
}
export function makeGoal(category = CATEGORIES[0]): Goal {
  const now = new Date().toISOString();
  return { id: uid(), title:'', description:'', category, priority:'Medium', status:'not-started', focus:false, dueDate:'',
    tracker:{ kind:'none', percent:0, current:0, target:0, unit:'', period:'weekly', events:[], values:{}, dailyAverage:false },
    subtasks:[], createdAt:now, updatedAt:now, completedAt:'' };
}
export function initialStore(): Store {
  function goal(title:string, category:string, kind:TrackerKind='none', description=''): Goal {
    return {...makeGoal(category), title, description, tracker:{...makeGoal(category).tracker, kind}};
  }
  const goals = [
    goal('Complete 3 diploma units by year end','Career & Learning','checklist','Complete the remaining diploma units.'),
    goal('Pass AZ-305','Career & Learning','percentage','Study and prepare for the Azure certification.'),
    goal('Look for a new job','Career & Learning','checklist','Research opportunities and build applications.'),
    goal('Gain leadership experience or take a soft-skills course','Career & Learning','checklist','Mentoring, presentations, stand-ups or training.'),
    goal('Work out 4 times a week including cardio','Health & Fitness','recurring','Track workouts each week.'),
    goal('Average 10,000 steps a day','Health & Fitness','number','Log daily steps to track your recorded seven-day average.'),
    goal('Save towards a house','Finances & Savings','number','Set your own savings target and balance.'),
    goal('Make a best friend in Australia','Social & Relationships','none','Focus on meaningful social activities.'),
    goal('Reach out to one person per month','Social & Relationships','recurring','Check in with someone each month.'),
    goal('Plan more hobbies or Xbox time with Dad','Lifestyle & Hobbies','checklist'),
    goal('Find a classic Manchester United shirt as a birthday present','Lifestyle & Hobbies'),
    goal('Complete the 30th anniversary LEGO set','Lifestyle & Hobbies','checklist'),
    goal('Get a tattoo','Big Plans','checklist'),
    goal('Explore cycling when the time is right','Big Plans','checklist'),
  ];
  goals[0].focus=true;
  goals[0].dueDate='2026-12-31';
  goals[0].subtasks = [1,2,3].map(n=>({id:uid(),title:`Complete diploma unit ${n}`,done:false}));
  goals[4].focus=true;
  goals[4].tracker.target=4;
  goals[4].tracker.period='weekly';
  goals[5].tracker.target=10000;
  goals[5].tracker.unit='steps';
  goals[5].tracker.dailyAverage=true;
  goals[6].focus=true;
  goals[6].tracker.unit='AUD';
  goals[8].tracker.target=1;
  goals[8].tracker.period='monthly';
  goals[12].subtasks=['Choose design','Research artists','Set budget','Book appointment'].map(title=>({id:uid(),title,done:false}));
  return {version:2, goals, categories:[...CATEGORIES], history:[]};
}
export function normalizeStore(raw:unknown): Store | null {
  if (!raw || typeof raw!=='object') return null;
  const value=raw as Partial<Store>;
  if (!Array.isArray(value.goals) || !Array.isArray(value.categories) || !value.categories.every(c=>typeof c==='string')) return null;
  if (!value.goals.every(g=>g && typeof g.id==='string' && typeof g.title==='string' && typeof g.category==='string' && g.tracker && typeof g.tracker.kind==='string' && Array.isArray(g.subtasks))) return null;
  const defaults=makeGoal();
  const goals: Goal[] = value.goals.map((g)=>({
    ...defaults, ...g, focus: typeof g.focus==='boolean' ? g.focus : false,
    tracker:{...defaults.tracker,...g.tracker,kind:String(g.tracker.kind)==='weekly'?'recurring':g.tracker.kind,
      events:Array.isArray(g.tracker.events)?g.tracker.events.filter(e=>typeof e==='string'):[],
      values:g.tracker.values&&typeof g.tracker.values==='object'?g.tracker.values:{},
      period:String(g.tracker.kind)==='weekly' ? 'weekly':g.tracker.period??'weekly',dailyAverage:!!g.tracker.dailyAverage},
    subtasks:g.subtasks.filter(s=>s && typeof s.id==='string' && typeof s.title==='string').map(s=>({...s,done:!!s.done})),
  }));
  const history = Array.isArray(value.history)?value.history.filter(h=>h && typeof h.at==='string' && typeof h.goalId==='string' && typeof h.detail==='string'):[];
  return {version:2,goals,categories:[...new Set(value.categories)],history};
}
export function displayDate(value:string):string {
  if (!value) return 'No deadline';
  const d=new Date(`${value}T12:00:00`);
  return Number.isNaN(d.getTime()) ? value : d.toLocaleDateString('en-AU',{day:'numeric',month:'short',year:'numeric'});
}
export function csvEscape(value:string|number): string {return `"${String(value??'').replace(/"/g,'""')}"`;}
export function downloadFile(name:string,content:string,type:string):void {
  const url=URL.createObjectURL(new Blob([content],{type}));
  const a=document.createElement('a');a.href=url;a.download=name;document.body.appendChild(a);a.click();a.remove();
  setTimeout(()=>URL.revokeObjectURL(url),1000);
}
export function csvOfGoals(goals:Goal[]):string {
  const header=['Title','Description','Category','Status','Priority','Focus','Due Date','Progress %','Tracker','Subtasks','Updated At'];
  const rows=goals.map(g=>[g.title,g.description,g.category,g.status,g.priority,g.focus?'Yes':'No',g.dueDate,progress(g)??'',g.tracker.kind,`${g.subtasks.filter(s=>s.done).length}/${g.subtasks.length}`,g.updatedAt]);
  return [header,...rows].map(row=>row.map(csvEscape).join(',')).join('\r\n');
}
