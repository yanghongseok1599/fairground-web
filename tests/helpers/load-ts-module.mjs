import fs from 'node:fs';
import path from 'node:path';
import { createRequire } from 'node:module';
import ts from 'typescript';
const nativeRequire = createRequire(import.meta.url);

// Exercise the actual stores without a browser, bundler, or a live Supabase.
export function moduleLoader(mocks = {}) {
  const cache = new Map();
  function load(filename) {
    const absolute = path.resolve(filename);
    if (cache.has(absolute)) return cache.get(absolute).exports;
    const loadedModule = { exports: {} };
    cache.set(absolute, loadedModule);
    const code = ts.transpileModule(fs.readFileSync(absolute, 'utf8'), {
      compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, esModuleInterop: true },
    }).outputText;
    const require = (name) => {
      if (Object.hasOwn(mocks, name)) return mocks[name];
      if (name.startsWith('@/') || name.startsWith('.')) {
        let target = name.startsWith('@/') ? path.resolve('src', name.slice(2)) : path.resolve(path.dirname(absolute), name);
        if (!path.extname(target)) target += '.ts';
        return load(target);
      }
      return nativeRequire(name);
    };
    new Function('require', 'module', 'exports', 'process', code)(require, loadedModule, loadedModule.exports, process);
    return loadedModule.exports;
  }
  return load;
}

export function memoryStorage() {
  const map = new Map();
  return { getItem: (key) => map.get(key) ?? null, setItem: (key, value) => map.set(key, value), removeItem: (key) => map.delete(key), clear: () => map.clear() };
}

export function storeFixture() {
  const requests = [];
  const responses = [];
  const supabase = {
    from: (table) => query({ table }),
    rpc: (rpc, args) => query({ rpc, args }),
    auth: { getUser: async () => ({ data: { user: { id: 'player-1' } } }) },
  };
  function query(request) {
    requests.push(request);
    const chain = {};
    for (const method of ['select','insert','update','delete','eq','order','limit','maybeSingle','single','is','in']) {
      chain[method] = (...args) => { (request.steps ??= []).push([method, ...args]); return chain; };
    }
    chain.then = (resolve, reject) => {
      if (!responses.length) return Promise.reject(new Error(`Unexpected request: ${JSON.stringify(request)}`)).then(resolve,reject);
      const response = responses.shift();
      return (response instanceof Error ? Promise.reject(response) : Promise.resolve(response)).then(resolve,reject);
    };
    return chain;
  }
  const load = moduleLoader({ '@/config/supabase': { supabase, isDemoMode: false } });
  const { useAuthStore: auth } = load('src/stores/authStore.ts');
  const { useDataStore: data } = load('src/stores/dataStore.ts');
  const player = { id:'player-1',uid:'player-1',name:'원래 이름',teamId:'',teamRole:undefined,role:'player',isApproved:true,
    number:7,position:'ALA',photoUrl:'photo',cardType:'gold',cardRating:87,cardSkin:'standard',nationality:'KOR',
    stats:{goals:19,assists:7,games:22,mom:3},badges:['earned'],penaltyStatus:{isBanned:false},createdAt:123,
    phone:'01000000000',portraitConsentAt:1000 };
  auth.setState({user:{uid:'player-1',email:'synthetic@example.com'},player,initialized:true});
  return {auth,data,player,requests,responses,supabase,load};
}
