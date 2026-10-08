/* Browser-only demo API used on GitHub Pages, where Python cannot run. */
(() => {
  let previewMode = false;
  try {
    previewMode = new URLSearchParams(location.search).get('staticDemo') === '1' || localStorage.getItem('pulse.static.preview') === 'true';
    if (new URLSearchParams(location.search).get('staticDemo') === '1') localStorage.setItem('pulse.static.preview', 'true');
  } catch (_) { /* allow the GitHub Pages hostname check below */ }
  if (!location.hostname.endsWith('github.io') && !previewMode) return;

  const TOPICS = ['Battery life', 'Camera', 'Price', 'Support', 'Delivery', 'Design'];
  const PLATFORMS = ['X', 'Reddit', 'Instagram', 'YouTube'];
  const COLORS = ['#28764f', '#d8765e', '#5478b8', '#aa6b9a', '#b18331', '#398e91'];
  const SAMPLE = {
    'Battery life': { positive: ['The Lumen phone battery lasts all day and then some.', 'Battery life is fantastic, even with heavy use.'], neutral: ['Battery life is fine for my usual day.'], negative: ['The battery drains too quickly by afternoon.', 'I am disappointed that the battery barely lasts.'] },
    Camera: { positive: ['The camera takes beautiful photos in low light.', 'Lumen camera details look crisp and natural.'], neutral: ['The camera is about what I expected.'], negative: ['The camera struggles with focus at night.', 'Photos look muddy and the camera disappoints.'] },
    Price: { positive: ['The price feels fair for such a polished phone.', 'Great value, the Lumen phone is worth every dollar.'], neutral: ['The price is close to other phones.'], negative: ['The price is too high for these features.', 'I regret paying so much for this phone.'] },
    Support: { positive: ['Support solved my problem quickly and kindly.', 'The support team was helpful and thoughtful.'], neutral: ['Support answered my question today.'], negative: ['Support ignored my request for days.', 'The support experience was frustrating and rude.'] },
    Delivery: { positive: ['My Lumen phone arrived early and in perfect shape.', 'Delivery was quick and the package was secure.'], neutral: ['The delivery arrived on the estimated date.'], negative: ['My delivery is really late and the box is damaged.', 'The shipment was delayed and nobody gave an update.'] },
    Design: { positive: ['The design feels elegant and comfortable to hold.', 'I love the clean design and premium finish.'], neutral: ['The design looks similar to the product photos.'], negative: ['The design feels cheap and slippery.', 'I dislike the bulky design of this phone.'] }
  };
  const LEXICON = { great:2.2,fantastic:2.6,beautiful:2.1,crisp:1.4,natural:1.1,fair:1.1,polished:1.6,worth:1.5,helpful:1.8,thoughtful:1.4,kindly:1.1,early:1.3,perfect:2.3,quick:1.1,secure:1.2,elegant:2,comfortable:1.7,love:2.5,clean:1.1,premium:1.5,good:1.4,solved:1.5,lasts:1.2,disappointed:-2,drains:-1.8,quickly:-.25,barely:-1.5,struggles:-1.5,muddy:-1.8,disappoints:-2,high:-1.2,regret:-2,frustrating:-2,rude:-2,ignored:-1.8,late:-1.7,damaged:-2,delayed:-1.6,cheap:-1.7,slippery:-1.3,dislike:-2,bulky:-1.2,problem:-.8,too:-.6 };
  const NEGATORS = new Set(['not','no','never','hardly','barely','without']);
  const INTENSIFIERS = { really:1.6,very:1.5,extremely:1.9,so:1.25,quite:1.2,incredibly:1.7 };
  const get = (key, fallback) => { try { const value = localStorage.getItem(`pulse.static.${key}`); return value ? JSON.parse(value) : fallback; } catch (_) { return fallback; } };
  const put = (key, value) => { try { localStorage.setItem(`pulse.static.${key}`, JSON.stringify(value)); } catch (_) { /* keep this session usable without persistence */ } };
  let seed = 934821;
  const random = () => { seed = (seed * 1664525 + 1013904223) >>> 0; return seed / 4294967296; };
  function analyze(text) {
    const matches = [...String(text).toLowerCase().matchAll(/[a-z']+/g)];
    let total = 0, weightTotal = 0;
    const words = [];
    for (let i = 0; i < matches.length; i += 1) {
      const word = matches[i][0], base = LEXICON[word] || 0;
      if (!base) continue;
      const before = matches.slice(Math.max(0, i - 3), i).map(match => match[0]);
      const negated = before.some(token => NEGATORS.has(token));
      const intensity = [...before].reverse().find(token => INTENSIFIERS[token]) || '';
      const weight = base * (INTENSIFIERS[intensity] || 1) * (negated ? -.85 : 1);
      total += weight; weightTotal += Math.abs(base) * (INTENSIFIERS[intensity] || 1);
      words.push({ word, sentiment: weight > 0 ? 'positive' : 'negative', weight: Number(weight.toFixed(3)), start: matches[i].index, end: matches[i].index + word.length });
    }
    const score = Math.max(-1, Math.min(1, total / Math.max(4, Math.sqrt(weightTotal) * 2.6)));
    return { score:Number(score.toFixed(3)), label:score > .15 ? 'positive' : score < -.15 ? 'negative' : 'neutral', words, highlighted_words:words, breakdown:{ positive:words.filter(word=>word.sentiment==='positive').length, negative:words.filter(word=>word.sentiment==='negative').length, neutral:0 } };
  }
  function dayDate(day, hour = 12) {
    const value = new Date(); value.setDate(value.getDate() - (29 - day)); value.setHours(hour, 0, 0, 0); return value.toISOString();
  }
  function seedPosts() {
    const stored = get('posts', null);
    if (stored && stored.length) return stored;
    const posts = [];
    for (let day = 0; day < 30; day += 1) for (let index = 0; index < 20; index += 1) {
      let topic = TOPICS[Math.floor(random() * TOPICS.length)];
      const draw = random();
      let tone = draw < .4 ? 'positive' : draw < .6 ? 'neutral' : 'negative';
      if (day >= 18 && day <= 23 && random() < .48) { topic = 'Delivery'; tone = 'negative'; }
      const options = SAMPLE[topic][tone], text = options[Math.floor(random() * options.length)], hour = Math.floor(random() * 24);
      const result = analyze(text);
      posts.push({ id:`seed-${day}-${index}`, day, created_at:dayDate(day,hour), hour, platform:PLATFORMS[Math.floor(random()*PLATFORMS.length)], topic, text, likes:Math.floor(random()*840), score:result.score, label:result.label });
    }
    put('posts', posts); return posts;
  }
  let posts = seedPosts();
  let user = get('user', null);
  let profile = get('profile', null);
  let team = get('team', null);
  if (!team) team = [{id:1,email:'morgan.lee@pulse.demo',name:'Morgan Lee',role:'Analyst'},{id:2,email:'jules.park@pulse.demo',name:'Jules Park',role:'Viewer'}];
  let statuses = get('statuses', {});
  const persistStatuses = () => put('statuses', statuses);
  const profileDefault = email => ({email,name:email.split('@')[0].split(/[._-]/).map(word=>word.charAt(0).toUpperCase()+word.slice(1)).join(' '),title:'Product Analyst',avatarColor:COLORS[0],notifications:{spike:true,weekly:true,tips:false},memberSince:new Date().toISOString().slice(0,10),repliesSent:0});
  const average = rows => rows.length ? rows.reduce((sum,row)=>sum+row.score,0)/rows.length : 0;
  const shares = rows => { const count=rows.length||1; return {positive:rows.filter(row=>row.label==='positive').length/count,neutral:rows.filter(row=>row.label==='neutral').length/count,negative:rows.filter(row=>row.label==='negative').length/count}; };
  const boundedDays = value => [7,14,30].includes(Number(value)) ? Number(value) : 7;
  const parameters = path => new URLSearchParams(String(path).split('?')[1] || '');
  const currentUser = () => user || {id:1,email:'demo@pulse.test',name:'Demo User'};
  function filtered(params) {
    const days=boundedDays(Number(params.get('days')||30)), platform=params.get('platform')||'', topic=params.get('topic')||'', tone=params.get('tone')||'', query=(params.get('q')||'').toLowerCase(), day=params.has('day')?Number(params.get('day')):null;
    let result=posts.filter(post=>post.day>=30-days && (!platform||post.platform===platform) && (!topic||post.topic===topic) && (!tone||post.label===tone) && (!query||post.text.toLowerCase().includes(query)) && (day===null||post.day===day));
    const sort=params.get('sort')||'newest';
    if(sort==='most_liked') result.sort((a,b)=>b.likes-a.likes||b.created_at.localeCompare(a.created_at));
    else if(sort==='most_negative') result.sort((a,b)=>a.score-b.score||b.created_at.localeCompare(a.created_at));
    else result.sort((a,b)=>b.created_at.localeCompare(a.created_at));
    const offset=Math.max(0,Number(params.get('offset')||0)), limit=Math.min(500,Math.max(1,Number(params.get('limit')||100)));
    return {posts:result.slice(offset,offset+limit),count:Math.min(limit,Math.max(0,result.length-offset)),total:result.length,days};
  }
  function summary(params) {
    const days=boundedDays(Number(params.get('days')||7)), start=30-days, platform=params.get('platform')||'',topic=params.get('topic')||'',tone=params.get('tone')||'',query=(params.get('q')||'').toLowerCase();
    const matching=posts.filter(post=>post.day>=start&&(!platform||post.platform===platform)&&(!tone||post.label===tone)&&(!query||post.text.toLowerCase().includes(query)));
    const current=matching.filter(post=>!topic||post.topic===topic);
    const previousStart=Math.max(0,30-days*2), previous=posts.filter(post=>post.day>=previousStart&&post.day<start&&(!platform||post.platform===platform)&&(!topic||post.topic===topic)&&(!tone||post.label===tone)&&(!query||post.text.toLowerCase().includes(query)));
    const daily=[];
    for(let day=start;day<30;day+=1){const rows=current.filter(post=>post.day===day), topicCounts=TOPICS.map(name=>({topic:name,count:rows.filter(post=>post.topic===name).length})).sort((a,b)=>b.count-a.count);daily.push({day,date:rows[0]?.created_at||null,mentions:rows.length,net:average(rows),positive:rows.filter(post=>post.label==='positive').length,neutral:rows.filter(post=>post.label==='neutral').length,negative:rows.filter(post=>post.label==='negative').length,topicCounts});}
    const currentShares=shares(current),previousShares=shares(previous),topicRows=TOPICS.map(name=>{const rows=matching.filter(post=>post.topic===name);return{topic:name,mentions:rows.length,average:average(rows),negativeShare:shares(rows).negative};}).sort((a,b)=>b.average-a.average);
    return {days,platform:platform||'All',topic:topic||'All',tone:tone||'All',query,mentions:current.length,net:average(current),...currentShares,previous:{mentions:previous.length,net:average(previous),...previousShares},comparison:{mentions:current.length-previous.length,net:average(current)-average(previous)},daily,topics:topicRows,platforms:PLATFORMS.map(name=>({platform:name,mentions:current.filter(post=>post.platform===name).length}))};
  }
  function makePost(text, platform, topic) {
    const result=analyze(text),now=new Date();
    const post={id:`local-${Date.now()}-${Math.random().toString(36).slice(2,7)}`,day:29,created_at:now.toISOString(),hour:now.getHours(),platform,topic,text,likes:0,score:result.score,label:result.label};
    posts.push(post);put('posts',posts);return post;
  }
  function listInbox(params) {
    const status=params.get('status')||'',sort=params.get('sort')||'newest';
    let rows=posts.filter(post=>post.label!=='positive').map(post=>({...post,status:statuses[post.id]?.status||'New',reply_text:statuses[post.id]?.replyText||''})).filter(post=>!status||post.status===status);
    if(sort==='most_liked')rows.sort((a,b)=>b.likes-a.likes);else if(sort==='most_negative')rows.sort((a,b)=>a.score-b.score);else rows.sort((a,b)=>b.created_at.localeCompare(a.created_at));
    return {mentions:rows.slice(0,30),total:rows.length};
  }
  function getTrends(params) {
    const platform=params.get('platform')||'',rows=posts.filter(post=>!platform||post.platform===platform);
    const trends=TOPICS.map(topic=>{const items=rows.filter(post=>post.topic===topic),recent=items.filter(post=>post.day>=23),previous=items.filter(post=>post.day>=16&&post.day<23);return{topic,mentions:items.length,last7:recent.length,previous7:previous.length,change:(recent.length-previous.length)/Math.max(1,previous.length),negativeShare:shares(items).negative,series:Array.from({length:30},(_,day)=>items.filter(post=>post.day===day).length)};});
    return {trends,platform:platform||'All'};
  }
  function getAlerts(params) {
    const threshold=Math.min(90,Math.max(5,Number(params.get('neg_threshold')||35))),multiplier=Math.min(5,Math.max(1.1,Number(params.get('volume_multiplier')||1.7))),topic=params.get('topic')||'';
    const rows=posts.filter(post=>!topic||post.topic===topic),baseline=rows.length/30,alerts=[];
    for(let day=0;day<30;day+=1){const group=rows.filter(post=>post.day===day);if(!group.length)continue;const negative=group.filter(post=>post.label==='negative').length/group.length,reasons=[];if(negative*100>=threshold)reasons.push({type:'negative-share',value:Math.round(negative*100)});if(group.length>=baseline*multiplier)reasons.push({type:'volume-spike',value:Number((group.length/Math.max(1,baseline)).toFixed(1))});if(reasons.length)alerts.push({day,date:group[0].created_at,mentions:group.length,net:average(group),negativeShare:negative,reasons});}
    return {thresholds:{neg_threshold:threshold,volume_multiplier:multiplier,topic:topic||'All'},alerts};
  }
  function report(days) {
    const start=30-days,rows=posts.filter(post=>post.day>=start),data=summary(new URLSearchParams({days:String(days)}));
    const ranked=TOPICS.map(topic=>({topic,rows:rows.filter(post=>post.topic===topic)})).sort((a,b)=>average(b.rows)-average(a.rows));
    const busiest=PLATFORMS.map(platform=>({platform,count:rows.filter(post=>post.platform===platform).length})).sort((a,b)=>b.count-a.count)[0];
    const worst=data.daily.filter(day=>day.mentions).sort((a,b)=>a.net-b.net)[0],date=worst?.date?new Date(worst.date).toLocaleDateString(undefined,{month:'short',day:'numeric'}):'N/A';
    return {days,text:['PULSE · LUMEN PHONE REPORT',`Last ${days} days`,'',`Mentions: ${rows.length}`,`Net sentiment: ${Math.round(average(rows)*100)}%`,`Most loved topic: ${ranked[0].topic} (${Math.round(average(ranked[0].rows)*100)}%)`,`Biggest pain point: ${ranked.at(-1).topic} (${Math.round(average(ranked.at(-1).rows)*100)}%)`,`Busiest platform: ${busiest.platform} (${busiest.count} mentions)`,`Worst day: ${date} (${Math.round((worst?.net||0)*100)}% net)`].join('\n')};
  }
  async function request(path, options = {}) {
    const method=(options.method||'GET').toUpperCase(),body=options.body||{},route=String(path).split('?')[0],params=parameters(path);
    if(route==='/auth/login'){
      const email=String(body.email||'').trim().toLowerCase(),password=String(body.password||'');
      if(!/^[^\s@]+@[^\s@]+\.[a-z0-9-]{2,}$/i.test(email)||password.length<6)throw new Error('Enter a valid email and password of at least 6 characters.');
      const accounts=get('accounts',{'demo@pulse.test':{password:'pulse-demo',name:'Demo User'}}),account=accounts[email];
      if(!account||account.password!==password)throw new Error('Email or password is incorrect.');
      user={id:email==='demo@pulse.test'?1:2,email,name:account.name};profile=get('profile',profileDefault(email));profile={...profile,email,name:profile.email===email?profile.name:account.name};put('profile',profile);put('user',user);
      return {token:`static-${btoa(email)}`,user:{id:user.id,email,name:user.name,title:profile.title,avatarColor:profile.avatarColor}};
    }
    if(route==='/auth/signup'){
      const email=String(body.email||'').trim().toLowerCase(),password=String(body.password||''),name=String(body.name||'').trim();
      if(!/^[^\s@]+@[^\s@]+\.[a-z0-9-]{2,}$/i.test(email))throw new Error('Enter a valid email address.');
      if(password.length<6)throw new Error('Password must be at least 6 characters.');if(!name)throw new Error('Enter your name.');
      const accounts=get('accounts',{'demo@pulse.test':{password:'pulse-demo',name:'Demo User'}});if(accounts[email])throw new Error('An account with this email already exists.');accounts[email]={password,name};put('accounts',accounts);user={id:Date.now(),email,name};profile={...profileDefault(email),name};put('profile',profile);put('user',user);put('team',team);
      return {token:`static-${btoa(email)}`,user:{id:user.id,email,name,title:profile.title,avatarColor:profile.avatarColor}};
    }
    if(route==='/summary')return summary(params);
    if(route==='/posts'&&method==='GET')return filtered(params);
    if(route==='/posts'&&method==='POST')return makePost(String(body.text||''),body.platform||'X',body.topic||'Design');
    if(route==='/analyze')return analyze(String(body.text||''));
    if(route==='/inbox'&&method==='GET')return listInbox(params);
    const inboxMatch=route.match(/^\/inbox\/([^/]+)$/);
    if(inboxMatch&&method==='PATCH'){
      const id=decodeURIComponent(inboxMatch[1]),post=posts.find(item=>item.id===id);if(!post)throw new Error('Mention not found.');
      const prior=statuses[id]||{status:'New',replyText:''},next={status:body.status||((body.replyText&&body.replyText!==prior.replyText)?'Replied':prior.status),replyText:body.replyText??prior.replyText};
      statuses[id]=next;persistStatuses();if(next.replyText&&next.replyText!==prior.replyText&&profile){profile.repliesSent=(profile.repliesSent||0)+1;put('profile',profile);}
      return {id,status:next.status,replyText:next.replyText,previous:prior};
    }
    if(route==='/trends')return getTrends(params);
    if(route==='/alerts')return getAlerts(params);
    if(route==='/reports')return report(boundedDays(Number(params.get('days')||7)));
    if(route==='/team'&&method==='GET')return {owner:{...currentUser(),role:'Owner'},members:team};
    if(route==='/team'&&method==='POST'){
      const email=String(body.email||'').trim().toLowerCase();if(!/^[^\s@]+@[^\s@]+\.[a-z0-9-]{2,}$/i.test(email))throw new Error('Enter a valid email address.');if(email===currentUser().email||team.some(member=>member.email===email))throw new Error('This email is already on the team.');
      const member={id:Date.now(),email,name:String(body.name||email.split('@')[0].replace(/[._-]/g,' ')),role:['Admin','Analyst','Viewer'].includes(body.role)?body.role:'Analyst'};team.push(member);put('team',team);return member;
    }
    const teamMatch=route.match(/^\/team\/(\d+)$/);
    if(teamMatch&&method==='PATCH'){const member=team.find(item=>item.id===Number(teamMatch[1]));if(!member)throw new Error('Team member not found.');member.role=body.role;put('team',team);return member;}
    if(teamMatch&&method==='DELETE'){const before=team.length;team=team.filter(item=>item.id!==Number(teamMatch[1]));put('team',team);if(before===team.length)throw new Error('Team member not found.');return{ok:true};}
    if(route==='/profile'&&method==='GET'){profile=profile||profileDefault(currentUser().email);return{...profile,email:currentUser().email,repliesSent:profile.repliesSent||0};}
    if(route==='/profile'&&method==='PUT'){profile={...profile,...body,email:currentUser().email};put('profile',profile);if(user){user.name=profile.name;put('user',user);}return{...profile,repliesSent:profile.repliesSent||0};}
    throw new Error('This action is not available in the static demo.');
  }
  function createLivePost() {
    let topic=TOPICS[Math.floor(Math.random()*TOPICS.length)],tone=Math.random()<.55?'negative':Math.random()<.65?'neutral':'positive';
    if(Math.random()<.3){topic='Delivery';tone='negative';}
    const text=SAMPLE[topic][tone][Math.floor(Math.random()*SAMPLE[topic][tone].length)];
    const post=makePost(text,PLATFORMS[Math.floor(Math.random()*PLATFORMS.length)],topic);
    const recent=posts.filter(item=>item.topic==='Delivery'&&item.label==='negative'&&Date.now()-new Date(item.created_at).getTime()<180000).length;
    return{post,alertTriggered:post.topic==='Delivery'&&post.label==='negative'&&recent>=3};
  }
  window.PulseStaticApi={request,createLivePost};
  window.PulseApi.API_ROOT='';
  window.PulseApi.staticMode=true;
})();
