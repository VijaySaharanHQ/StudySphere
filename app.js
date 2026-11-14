import { initializeApp } from "https://www.gstatic.com/firebasejs/12.19.0/firebase-app.js";
import { getAuth, signInWithEmailAndPassword, onAuthStateChanged, signOut } from "https://www.gstatic.com/firebasejs/12.19.0/firebase-auth.js";
import { getFirestore, collection, doc, getDoc, addDoc, updateDoc, deleteDoc, onSnapshot, query, orderBy, serverTimestamp, writeBatch, getDocs } from "https://www.gstatic.com/firebasejs/12.19.0/firebase-firestore.js";

/* 1) Paste the Firebase web-app configuration from Firebase Console here. */
// For Firebase JS SDK v7.20.0 and later, measurementId is optional
const firebaseConfig = {
  apiKey: "AIzaSyBvQIKvNd6pqyHSag4q5JICpVguSvNB1LQ",
  authDomain: "studysphere-46c62.firebaseapp.com",
  projectId: "studysphere-46c62",
  storageBucket: "studysphere-46c62.firebasestorage.app",
  messagingSenderId: "794633858734",
  appId: "1:794633858734:web:e303482cd6783e3c54873f",
  measurementId: "G-HLEB3PK88J"
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);
const analytics = getAnalytics(app);


// Initialize Firebase
const app = initializeApp(firebaseConfig);
const analytics = getAnalytics(app);

/* Keep this group ID identical to the Firestore rules and setup guide. */
const GROUP_ID = "studysphere";
const STUDENTS = ["Vijay", "Shambhavi", "Palak"];
const SUBJECTS = ["Physics", "Chemistry", "Mathematics"];
const CHAPTERS = {
  Physics: ["Electric Charges and Fields","Electrostatic Potential and Capacitance","Current Electricity","Moving Charges and Magnetism","Magnetism and Matter","Electromagnetic Induction","Alternating Current","Electromagnetic Waves","Ray Optics and Optical Instruments","Wave Optics","Dual Nature of Radiation and Matter","Atoms","Nuclei","Semiconductor Electronics"],
  Chemistry: ["Solutions","Electrochemistry","Chemical Kinetics","The d- and f-Block Elements","Coordination Compounds","Haloalkanes and Haloarenes","Alcohols, Phenols and Ethers","Aldehydes, Ketones and Carboxylic Acids","Amines","Biomolecules"],
  Mathematics: ["Relations and Functions","Inverse Trigonometric Functions","Matrices","Determinants","Continuity and Differentiability","Applications of Derivatives","Integrals","Applications of Integrals","Differential Equations","Vector Algebra","Three-Dimensional Geometry","Linear Programming","Probability"]
};
const PRACTICAL_DEFAULTS = [
  ["Physics","Practical file","Complete experiments, observations and record"],
  ["Chemistry","Practical file","Complete experiments, salt analysis / project as assigned"],
  ["Mathematics","Activities / project","Complete activity record and project work"]
];
let app, auth, db, currentUser=null, currentMember=null, activeView="dashboard", unsubscribers=[], cache={tasks:[],syllabus:[],timetable:[],practicals:[],goals:[],notes:[],exams:[]};
const $ = id => document.getElementById(id);
const groupPath = name => collection(db,"groups",GROUP_ID,name);
const groupDoc = (name,id) => doc(db,"groups",GROUP_ID,name,id);
const esc = value => String(value ?? "").replace(/[&<>"']/g, c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]));
const todayISO = () => new Date().toISOString().slice(0,10);
const prettyDate = value => value ? new Date(value+"T00:00:00").toLocaleDateString("en-IN",{day:"numeric",month:"short",year:"numeric"}) : "No date";
const initials = name => (name||"S").trim().charAt(0).toUpperCase();
const statusLabel = s => ({ "not-started":"Not started","in-progress":"In progress","revised":"Revised","completed":"Completed" }[s] || s);
const toast = msg => { $("toast").textContent=msg; $("toast").classList.add("show"); setTimeout(()=>$("toast").classList.remove("show"),2600); };
const setMessage = msg => $("authMessage").textContent=msg;
function showAuth(){ $("authScreen").classList.remove("hidden"); $("appShell").classList.add("hidden"); }
function showApp(){ $("authScreen").classList.add("hidden"); $("appShell").classList.remove("hidden"); }
function clearListeners(){unsubscribers.forEach(fn=>fn());unsubscribers=[];}
function listenAll(){
  clearListeners();
  ["tasks","syllabus","timetable","practicals","goals","notes","exams"].forEach(name=>{
    const stop=onSnapshot(groupPath(name),snap=>{
      cache[name]=snap.docs.map(d=>({id:d.id,...d.data()}));
      if(activeView==="dashboard") renderDashboard();
      else renderView(activeView);
    },err=>{console.error(err);toast("Could not sync "+name+". Check Firestore rules.");});
    unsubscribers.push(stop);
  });
}
async function seedIfEmpty(){
  const snap=await getDocs(groupPath("syllabus"));
  if(!snap.empty) return;
  const batch=writeBatch(db);
  STUDENTS.forEach(student=>{
    Object.entries(CHAPTERS).forEach(([subject,chapters])=>chapters.forEach((chapter,index)=>{
      const ref=doc(groupPath("syllabus"));
      batch.set(ref,{student,subject,chapter,status:"not-started",order:index,createdAt:serverTimestamp()});
    }));
    PRACTICAL_DEFAULTS.forEach(([subject,title,description])=>{
      const ref=doc(groupPath("practicals"));
      batch.set(ref,{student,subject,title,description,status:"not-started",dueDate:"",createdAt:serverTimestamp()});
    });
  });
  await batch.commit();
}
function dateGreeting(){const d=new Date();$("dateLabel").textContent=d.toLocaleDateString("en-IN",{weekday:"long",day:"numeric",month:"long"}).toUpperCase();}
function memberName(){return currentMember?.name || currentUser?.email?.split("@")[0] || "Student";}
function bindAuth(){
  $("loginForm").addEventListener("submit",async e=>{
    e.preventDefault(); const btn=e.submitter; btn.disabled=true;setMessage("Signing in securely…");
    try{await signInWithEmailAndPassword(auth,$("email").value.trim(),$("password").value);}
    catch(err){setMessage(authError(err));}
    finally{btn.disabled=false;}
  });
  $("signOutBtn").addEventListener("click",()=>signOut(auth));
  $("menuBtn").addEventListener("click",()=>$("sidebar").classList.toggle("open"));
  document.querySelectorAll(".nav-item").forEach(btn=>btn.addEventListener("click",()=>navigate(btn.dataset.view)));
  $("content").addEventListener("click",e=>{
    const go=e.target.closest("[data-go]"); if(go) navigate(go.dataset.go);
  });
}
function authError(err){return err.code==="auth/invalid-credential"?"Email or password is incorrect.":err.code==="auth/too-many-requests"?"Too many attempts. Please try again later.":err.message||"Sign-in failed.";}
async function handleUser(user){
  currentUser=user;
  if(!user){clearListeners();currentMember=null;showAuth();return;}
  try{
    const memberSnap=await getDoc(doc(db,"groups",GROUP_ID,"members",user.uid));
    if(!memberSnap.exists()){await signOut(auth);setMessage("This account is not a member of the StudySphere group. Ask the group administrator to add it.");return;}
    currentMember=memberSnap.data();
    if(!STUDENTS.includes(currentMember.name)){await signOut(auth);setMessage("This account is not assigned to a recognised student profile.");return;}
    showApp(); $("userName").textContent=currentMember.name; $("userAvatar").textContent=initials(currentMember.name);
    dateGreeting(); listenAll(); await seedIfEmpty();
    renderDashboard();
  }catch(err){console.error(err);await signOut(auth);setMessage("Could not load your profile. Check your Firebase setup and security rules.");}
}
function navigate(view){
  activeView=view; $("sidebar").classList.remove("open");
  document.querySelectorAll(".nav-item").forEach(b=>b.classList.toggle("active",b.dataset.view===view));
  const titles={dashboard:"Overview",syllabus:"Syllabus tracker",timetable:"Timetable",tasks:"Tasks & homework",practicals:"Practicals",exam:"JEE & pre-boards",goals:"Shared goals",notes:"Study notes"};
  $("viewTitle").textContent=titles[view]||"StudySphere";
  renderView(view);
}
function statCard(label,value,foot,icon){return `<div class="stat-card"><div class="stat-top"><span>${label}</span><span class="stat-icon">${icon}</span></div><div class="stat-value">${value}</div><div class="stat-foot">${foot}</div></div>`;}
function completionFor(student){const rows=cache.syllabus.filter(x=>x.student===student);return rows.length?Math.round(rows.filter(x=>x.status==="completed"||x.status==="revised").length/rows.length*100):0;}
function renderDashboard(){
  const mine=cache.tasks.filter(t=>t.assignedTo===currentMember?.name&&!t.completed);
  const allOpen=cache.tasks.filter(t=>!t.completed).sort((a,b)=>(a.dueDate||"9999").localeCompare(b.dueDate||"9999"));
  const completed=cache.tasks.filter(t=>t.completed).length;
  const total=cache.syllabus.filter(x=>x.student===currentMember?.name).length;
  const done=cache.syllabus.filter(x=>x.student===currentMember?.name&&(x.status==="completed"||x.status==="revised")).length;
  const practicalDone=cache.practicals.filter(x=>x.student===currentMember?.name&&x.status==="completed").length;
  $("statsGrid").innerHTML=[
    statCard("MY CHAPTERS",`${done}/${total}`,"Completed or revised","▤"),
    statCard("OPEN TASKS",mine.length,"Assigned to you","☑"),
    statCard("PRACTICALS",`${practicalDone}/3`,"Practical records completed","⚗"),
    statCard("GROUP TASKS DONE",completed,"Shared task list","✦")
  ].join("");
  $("memberCards").innerHTML=STUDENTS.map(n=>`<div class="member-row"><div class="avatar">${initials(n)}</div><div><b>${n}</b><small>Class 12 · Physics, Chemistry, Mathematics</small></div><span class="member-status">${completionFor(n)}% done</span></div>`).join("");
  $("upcomingTasks").innerHTML=allOpen.slice(0,4).map(t=>`<div class="simple-item"><div><b>${esc(t.title)}</b><small>${esc(t.assignedTo||"Group")} · ${esc(t.category||"Study task")}</small></div><span class="due">${prettyDate(t.dueDate)}</span></div>`).join("")||`<div class="empty-state">No upcoming tasks. Add one from Tasks & homework.</div>`;
  $("groupProgress").innerHTML=STUDENTS.map(n=>`<div class="progress-row"><div class="progress-row-head"><span>${n}</span><b>${completionFor(n)}%</b></div><div class="progress-line"><span style="width:${completionFor(n)}%"></span></div></div>`).join("");
}
function heading(title,desc,action=""){return `<div class="page-heading"><div><h1>${title}</h1><p>${desc}</p></div>${action}</div>`;}
function formPanel(title,fields,submitLabel="Add item"){return `<section class="form-panel"><h3>${title}</h3><form class="form-grid" data-form="${fields.key}">${fields.html}<button class="btn primary" type="submit">${submitLabel}</button></form></section>`;}
function studentSelect(name="student",includeGroup=false){return `<label>Student<select name="${name}">${includeGroup?'<option value="Group">Whole group</option>':""}${STUDENTS.map(n=>`<option ${n===currentMember?.name?"selected":""}>${n}</option>`).join("")}</select></label>`;}
function table(rows,headers,renderRow){return `<div class="data-panel"><table class="data-table"><thead><tr>${headers.map(h=>`<th>${h}</th>`).join("")}</tr></thead><tbody>${rows.length?rows.map(renderRow).join(""):`<tr><td colspan="${headers.length}"><div class="empty-state">Nothing here yet.</div></td></tr>`}</tbody></table></div>`;}
function renderView(view){
  if(view==="dashboard"){renderDashboard();return;}
  const content=$("content");
  if(view==="syllabus") content.innerHTML=renderSyllabus();
  if(view==="timetable") content.innerHTML=renderTimetable();
  if(view==="tasks") content.innerHTML=renderTasks();
  if(view==="practicals") content.innerHTML=renderPracticals();
  if(view==="exam") content.innerHTML=renderExam();
  if(view==="goals") content.innerHTML=renderGoals();
  if(view==="notes") content.innerHTML=renderNotes();
}
function renderSyllabus(){
  const selected=window.syllabusFilter||currentMember.name;
  const rows=cache.syllabus.filter(x=>x.student===selected).sort((a,b)=>SUBJECTS.indexOf(a.subject)-SUBJECTS.indexOf(b.subject)||a.order-b.order);
  const filter=`<select class="filter-select" id="syllabusStudent">${STUDENTS.map(n=>`<option ${n===selected?"selected":""}>${n}</option>`).join("")}</select>`;
  return heading("Class 12 PCM syllabus","CBSE-aligned chapter tracker. Update a chapter as you study.",filter)+table(rows,["SUBJECT","CHAPTER","STATUS","UPDATE"],r=>`<tr><td><span class="subject-pill">${r.subject}</span></td><td>${esc(r.chapter)}</td><td>${statusLabel(r.status)}</td><td><select class="status-select" data-syllabus="${r.id}">${["not-started","in-progress","revised","completed"].map(s=>`<option value="${s}" ${r.status===s?"selected":""}>${statusLabel(s)}</option>`).join("")}</select></td></tr>`);
}
function renderTimetable(){
  const rows=cache.timetable.filter(x=>x.student===currentMember.name||x.student==="Group").sort((a,b)=>(a.dayOrder??8)-(b.dayOrder??8)||(a.startTime||"").localeCompare(b.startTime||""));
  return heading("Weekly timetable","Add live classes, self-study, revision and breaks.")+formPanel("Add a timetable block",{key:"timetable",html:`${studentSelect("student",true)}<label>Day<select name="day">${["Monday","Tuesday","Wednesday","Thursday","Friday","Saturday","Sunday"].map(x=>`<option>${x}</option>`).join("")}</select></label><label>Start time<input name="startTime" type="time" required></label><label>End time<input name="endTime" type="time" required></label><label class="span2">Study block<input name="title" placeholder="e.g. Physics live class / Maths practice" required></label><label>Subject<select name="subject"><option>Physics</option><option>Chemistry</option><option>Mathematics</option><option>Break</option><option>Other</option></select></label>`})+table(rows,["DAY","TIME","STUDENT","BLOCK","SUBJECT",""],r=>`<tr><td>${r.day}</td><td>${r.startTime}–${r.endTime}</td><td>${esc(r.student)}</td><td>${esc(r.title)}</td><td>${esc(r.subject)}</td><td><button class="small-btn danger" data-delete="timetable" data-id="${r.id}">Delete</button></td></tr>`);
}
function renderTasks(){
  const rows=[...cache.tasks].sort((a,b)=>(a.completed?1:0)-(b.completed?1:0)||(a.dueDate||"9999").localeCompare(b.dueDate||"9999"));
  return heading("Tasks & homework","Shared task board for classes, NCERT, PYQs, revision and assignments.")+formPanel("Create a study task",{key:"tasks",html:`<label class="span2">Task title<input name="title" placeholder="e.g. Solve 25 Current Electricity PYQs" required></label>${studentSelect("assignedTo",true)}<label>Category<select name="category"><option>JEE practice</option><option>Board preparation</option><option>Live class homework</option><option>Revision</option><option>Practical</option><option>Other</option></select></label><label>Due date<input name="dueDate" type="date" min="${todayISO()}"></label>`})+table(rows,["TASK","ASSIGNED TO","CATEGORY","DUE DATE","STATUS",""],r=>`<tr><td class="${r.completed?"task-done":""}">${esc(r.title)}</td><td>${esc(r.assignedTo)}</td><td>${esc(r.category)}</td><td>${prettyDate(r.dueDate)}</td><td>${r.completed?"Completed":"Open"}</td><td><div class="task-actions"><button class="small-btn" data-complete="${r.id}" data-value="${!r.completed}">${r.completed?"Reopen":"Done"}</button><button class="small-btn danger" data-delete="tasks" data-id="${r.id}">×</button></div></td></tr>`);
}
function renderPracticals(){
  const rows=cache.practicals.filter(x=>x.student===currentMember.name||x.student==="Group");
  return heading("Practical work","Keep practical files, experiments, activities, projects and viva preparation on track.")+formPanel("Add a practical / project item",{key:"practicals",html:`${studentSelect()}<label>Subject<select name="subject"><option>Physics</option><option>Chemistry</option><option>Mathematics</option></select></label><label>Due date<input name="dueDate" type="date"></label><label class="span2">Title<input name="title" placeholder="Experiment / file / project / viva" required></label><label class="span2">Details<input name="description" placeholder="What needs to be completed?"></label>`})+`<div class="cards-grid">${rows.map(r=>`<article class="mini-card"><div class="panel-head"><span class="subject-pill">${r.subject}</span><span class="soft-tag">${statusLabel(r.status)}</span></div><h3>${esc(r.title)}</h3><p>${esc(r.description||"No extra details")}</p><p>Owner: ${esc(r.student)} · Due: ${prettyDate(r.dueDate)}</p><div class="toolbar"><select class="status-select" data-practical="${r.id}">${["not-started","in-progress","completed"].map(s=>`<option value="${s}" ${r.status===s?"selected":""}>${statusLabel(s)}</option>`).join("")}</select><button class="small-btn danger" data-delete="practicals" data-id="${r.id}">Delete</button></div></article>`).join("")||`<div class="empty-state">No practical items yet.</div>`}</div>`;
}
function renderExam(){
  const rows=cache.exams.sort((a,b)=>(a.date||"9999").localeCompare(b.date||"9999"));
  return heading("JEE Main & pre-boards","Plan CBSE pre-board preparation, JEE practice, mock tests and exam milestones.")+formPanel("Add an exam milestone",{key:"exams",html:`${studentSelect("student",true)}<label>Type<select name="type"><option>CBSE pre-board</option><option>JEE mock test</option><option>JEE Main</option><option>CBSE practical</option><option>Board exam</option><option>Other</option></select></label><label>Date<input name="date" type="date"></label><label class="span2">Title<input name="title" placeholder="e.g. Full syllabus PCM mock test" required></label><label class="span2">Preparation note<input name="note" placeholder="Chapters / target / revision focus"></label>`})+table(rows,["MILESTONE","TYPE","STUDENT","DATE","PREPARATION",""],r=>`<tr><td>${esc(r.title)}</td><td><span class="subject-pill">${esc(r.type)}</span></td><td>${esc(r.student)}</td><td>${prettyDate(r.date)}</td><td>${esc(r.note||"—")}</td><td><button class="small-btn danger" data-delete="exams" data-id="${r.id}">Delete</button></td></tr>`)+`<p class="helper">Exam dates should be entered only after checking the official CBSE / NTA notice. This planner does not assume or guarantee exam dates.</p>`;
}
function renderGoals(){
  const rows=cache.goals;
  return heading("Shared study goals","Set group targets and celebrate consistent effort.")+formPanel("Create a shared goal",{key:"goals",html:`<label class="span2">Goal<input name="title" placeholder="e.g. Complete Electrostatics revision" required></label>${studentSelect("owner",true)}<label>Target date<input name="dueDate" type="date"></label><label class="span2">Why it matters<input name="description" placeholder="A short reason or success measure"></label>`})+`<div class="cards-grid">${rows.map(r=>`<article class="mini-card"><div class="panel-head"><span class="soft-tag">${esc(r.owner)}</span><button class="small-btn danger" data-delete="goals" data-id="${r.id}">Delete</button></div><h3>${esc(r.title)}</h3><p>${esc(r.description||"Keep moving forward together.")}</p><p>Target: ${prettyDate(r.dueDate)}</p><label class="check-row"><input type="checkbox" data-goal="${r.id}" ${r.completed?"checked":""}> Goal achieved</label></article>`).join("")||`<div class="empty-state">Add your first shared goal.</div>`}</div>`;
}
function renderNotes(){
  const rows=cache.notes.sort((a,b)=>(b.createdAt?.seconds||0)-(a.createdAt?.seconds||0));
  return heading("Study notes","Share concise formulas, doubts, revision pointers and useful reminders.")+formPanel("Add a study note",{key:"notes",html:`${studentSelect("author",true)}<label>Subject<select name="subject"><option>Physics</option><option>Chemistry</option><option>Mathematics</option><option>General</option></select></label><label class="span2">Title<input name="title" placeholder="e.g. Important integration formulas" required></label><label class="span2">Note<textarea name="body" placeholder="Write your note or revision pointer…" required></textarea></label>`})+`<div class="cards-grid">${rows.map(r=>`<article class="mini-card note-card"><div class="panel-head"><span class="subject-pill">${esc(r.subject)}</span><button class="small-btn danger" data-delete="notes" data-id="${r.id}">Delete</button></div><h3>${esc(r.title)}</h3><p>${esc(r.body)}</p><p>By ${esc(r.author)} · Shared note</p></article>`).join("")||`<div class="empty-state">No shared notes yet.</div>`}</div>`;
}
async function addRecord(collectionName,data){await addDoc(groupPath(collectionName),{...data,createdAt:serverTimestamp(),createdBy:currentUser.uid});toast("Saved and synced with your group.");}
$("content").addEventListener("submit",async e=>{
  const form=e.target.closest("form[data-form]");if(!form)return;e.preventDefault();
  const data=Object.fromEntries(new FormData(form).entries());
  try{
    if(form.dataset.form==="timetable"){const days=["Monday","Tuesday","Wednesday","Thursday","Friday","Saturday","Sunday"];data.dayOrder=days.indexOf(data.day);}
    if(form.dataset.form==="tasks")data.completed=false;
    if(form.dataset.form==="practicals")data.status="not-started";
    if(form.dataset.form==="goals")data.completed=false;
    await addRecord(form.dataset.form,data);form.reset();renderView(activeView);
  }catch(err){console.error(err);toast("Save failed. Check your connection and Firestore rules.");}
});
$("content").addEventListener("change",async e=>{
  const t=e.target;
  try{
    if(t.dataset.syllabus)await updateDoc(groupDoc("syllabus",t.dataset.syllabus),{status:t.value});
    if(t.dataset.practical)await updateDoc(groupDoc("practicals",t.dataset.practical),{status:t.value});
    if(t.dataset.goal)await updateDoc(groupDoc("goals",t.dataset.goal),{completed:t.checked});
    if(t.id==="syllabusStudent"){window.syllabusFilter=t.value;renderView("syllabus");}
  }catch(err){console.error(err);toast("Update failed. Check Firestore rules.");}
});
$("content").addEventListener("click",async e=>{
  const del=e.target.closest("[data-delete]"),complete=e.target.closest("[data-complete]");
  try{
    if(del){if(!confirm("Delete this shared item for everyone in the group?"))return;await deleteDoc(groupDoc(del.dataset.delete,del.dataset.id));toast("Item deleted.");}
    if(complete){await updateDoc(groupDoc("tasks",complete.dataset.complete),{completed:complete.dataset.value==="true"});toast("Task updated.");}
  }catch(err){console.error(err);toast("Action failed. Check Firestore rules.");}
});

/* Simple local Pomodoro timer: 25-minute focus, then 5-minute break. */
let timerSeconds=25*60,timerInterval=null,breakMode=false;
function paintTimer(){const m=String(Math.floor(timerSeconds/60)).padStart(2,"0"),s=String(timerSeconds%60).padStart(2,"0");$("timerDisplay").textContent=`${m}:${s}`;$("timerMode").textContent=breakMode?"BREAK TIME":"FOCUS TIME";}
$("timerStart").addEventListener("click",()=>{
  if(timerInterval){clearInterval(timerInterval);timerInterval=null;$("timerStart").textContent="Resume";return;}
  $("timerStart").textContent="Pause";
  timerInterval=setInterval(()=>{timerSeconds--;paintTimer();if(timerSeconds<=0){clearInterval(timerInterval);timerInterval=null;breakMode=!breakMode;timerSeconds=(breakMode?5:25)*60;paintTimer();$("timerStart").textContent="Start focus";toast(breakMode?"Focus complete. Take a short break.":"Break complete. Ready for another focus session?");}},1000);
});
$("timerReset").addEventListener("click",()=>{clearInterval(timerInterval);timerInterval=null;breakMode=false;timerSeconds=25*60;paintTimer();$("timerStart").textContent="Start focus";});

try{
  if(firebaseConfig.apiKey==="PASTE_API_KEY"||firebaseConfig.projectId==="YOUR_PROJECT_ID")throw new Error("Add your Firebase web configuration in app.js before using StudySphere.");
  app=initializeApp(firebaseConfig);auth=getAuth(app);db=getFirestore(app);bindAuth();onAuthStateChanged(auth,handleUser);
}catch(err){console.error(err);setMessage(err.message);showAuth();}
