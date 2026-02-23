#!/usr/bin/env node
/**
 * Rebuilds word-groups.json with:
 * - Complexity based on word frequency (1=common, 2=medium, 3=rare)
 * - One list per (category, complexity)
 * - All words in same category combined
 */

const fs = require('fs');
const path = require('path');

// Common words from frequency lists (top ~2000) - complexity 1
const COMMON_WORDS = new Set([
  'the','of','and','to','a','in','for','is','on','that','by','this','with','you','it','not','or','be','are','from','at','as','your','all','have','new','more','an','was','we','will','home','can','us','about','if','my','has','search','free','but','our','one','other','do','no','time','they','site','he','up','may','what','which','their','news','out','use','any','there','see','only','so','his','when','here','who','get','first','am','been','would','how','were','me','some','these','click','its','like','than','find','date','back','top','people','had','list','name','just','over','state','year','day','into','two','health','world','next','used','go','work','last','most','make','them','should','her','city','add','good','well','where','much','before','through','right','means','still','way','after','many','must','where','also','back','those','come','both','between','each','own','under','while','high','same','another','end','most','through','after','before','hand','part','right','place','old','too','same','another','great','where','every','small','found','still','between','man','own','here','through','both','long','being','under','never','again','same','another','know','while','last','might','next','always','those','each','every','during','before','under','again','between','place','own','part','hand','head','eye','face','heart','arm','body','leg','foot','hand','finger','nose','ear','mouth','lip','hair','skin','face','back','chest','neck','shoulder','knee','toe','bone','blood','brain','heart','lung','liver','stomach','bone','red','blue','green','black','white','brown','yellow','pink','gray','gold','cat','dog','bird','fish','horse','cow','pig','sheep','bear','lion','wolf','deer','duck','goat','tree','leaf','flower','grass','sun','moon','star','rain','snow','wind','cloud','water','fire','earth','stone','rock','sand','door','room','wall','table','chair','bed','book','food','water','milk','bread','rice','apple','fruit','meat','egg','bread','cheese','soup','tea','coffee','sugar','salt','rice','wheat','bread','cake','pie','cookie','milk','cream','butter','egg','fish','meat','chicken','beef','pork','lamb','tomato','potato','carrot','onion','apple','banana','orange','grape','berry','peach','pear','plum','lemon','lime','mango','melon','peach','sun','cloud','rain','snow','wind','storm','fog','mist','cold','hot','warm','cool','weather','season','spring','summer','fall','winter','day','night','morning','evening','noon','midnight','light','dark','bright','shadow','sun','moon','star','sky','earth','ground','hill','mountain','lake','river','sea','ocean','beach','shore','stream','pond','pool','wave','tide','current','flow','water','ice','rain','snow','frost','mist','hail','dew','flood','drought','damp','wet','dry','humid','moist','arid'
]);

// Medium frequency - complexity 2
const MEDIUM_WORDS = new Set([
  'animal','color','house','kitchen','bathroom','bedroom','living','floor','ceiling','window','door','desk','lamp','sofa','shelf','table','chair','bed','rug','oven','sink','bath','hall','frog','bear','deer','duck','goat','mole','seal','swan','crab','otter','camel','panda','koala','zebra','moose','bison','llama','yak','eagle','hawk','owl','shark','whale','rhino','mouse','rabbit','tiger','snake','sheep','fox','bat','ant','bee','fly','bug','gecko','lemur','hyena','cobra','heron','stork','crane','finch','robin','crow','dove','parrot','macaw','toucan','pelican','salmon','trout','tuna','cod','bass','perch','carp','eel','squid','octopus','lobster','shrimp','oyster','clam','jellyfish','beaver','raccoon','skunk','badger','weasel','ferret','hedgehog','porcupine','armadillo','sloth','anteater','tapir','giraffe','elephant','hippo','gorilla','monkey','ape','chimp','baboon','marmoset','penguin','flamingo','albatross','gull','tern','puffin','cormorant','ibis','egret','spoonbill','turtle','lizard','iguana','chameleon','skink','salamander','newt','toad','tadpole','viper','python','boa','dolphin','porpoise','orca','walrus','manatee','muskrat','platypus','echidna','kangaroo','wallaby','wombat','spider','scorpion','centipede','millipede','caterpillar','butterfly','moth','dragonfly','grasshopper','cricket','cicada','beetle','ladybug','firefly','hamster','gerbil','squirrel','chipmunk','marmot','gopher','vole','lemming','rat','shrew','cougar','puma','jaguar','leopard','cheetah','lynx','bobcat','ocelot','leopard','navy','teal','mint','lime','rust','sand','coal','rose','beige','cream','ivory','tan','olive','coral','salmon','peach','plum','violet','indigo','cyan','amber','azure','crimson','emerald','scarlet','cobalt','maroon','burgundy','magenta','turquoise','aqua','lavender','lilac','mauve','grape','berry','cherry','dates','figs','kiwi','prune','papaya','pineapple','coconut','avocado','guava','lychee','persimmon','pomegranate','cranberry','blueberry','strawberry','raspberry','blackberry','currant','raisin','date','fig','apricot','nectarine','watermelon','cantaloupe','honeydew','river','stream','creek','brook','pond','pool','ocean','bay','cove','beach','shore','cliff','canyon','valley','flower','bloom','petal','stem','root','branch','bark','seed','sprout','bud','thorn','vine','fern','grass','weed','mountain','peak','ridge','slope','volcano','glacier','forest','woods','meadow','field','pasture','garden','desert','dune','cave','cavern','waterfall','cascade','spring','summer','autumn','winter','season','island','peninsula','forecast','pressure','temperature','humidity','breeze','gust','thunder','lightning','hurricane','tornado','blizzard','sleet','drizzle','frost','dew','mist','haze','fog','smog','vapor','steam','condensation','evaporation','precipitation'
]);

// Words not in COMMON or MEDIUM = complexity 3

const inputPath = path.join(__dirname, '../word-groups.json');
const data = JSON.parse(fs.readFileSync(inputPath, 'utf8'));

function getComplexity(word) {
  const w = word.toLowerCase().trim();
  if (COMMON_WORDS.has(w)) return 1;
  if (MEDIUM_WORDS.has(w)) return 2;
  return 3;
}

const result = {};

for (const group of data) {
  const category = group.category;
  if (!result[category]) result[category] = { category, sets: {} };

  for (const set of group.sets || []) {
    for (const word of set.list || []) {
      const w = word.trim();
      if (!w) continue;
      const complexity = getComplexity(w);
      const key = complexity;
      if (!result[category].sets[key]) {
        result[category].sets[key] = { complexity, list: [] };
      }
      const list = result[category].sets[key].list;
      if (!list.includes(w)) list.push(w);
    }
  }
}

const output = Object.values(result).map(g => ({
  category: g.category,
  sets: Object.values(g.sets).map(s => ({
    complexity: s.complexity,
    list: s.list.sort()
  })).sort((a, b) => a.complexity - b.complexity)
}));

fs.writeFileSync(inputPath, JSON.stringify(output, null, 2));
console.log('Done. Categories:', output.length);
for (const g of output) {
  console.log(`  ${g.category}: ${g.sets.length} sets, ${g.sets.map(s => `complexity ${s.complexity}: ${s.list.length} words`).join(', ')}`);
}
