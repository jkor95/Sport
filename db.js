(function(SK){
  'use strict';
  let user=null,revision=0;
  const Auth=globalThis.MijnLoopLocalAuth;
  const configured=()=>!!Auth&&!!globalThis.SPORT_CONFIG?.supabaseUrl;
  async function connect(){if(!Auth)throw new Error('Accountmodule ontbreekt.');return Auth.connect();}
  async function load(){const r=await Auth.loadState();user=r.user||Auth.currentUser();revision=Number(r.revision||0);const state=r.state||SK.freshState();SK.validateState(state);return {state,user};}
  async function save(state){SK.validateState(state);const r=await Auth.saveState(state,revision);revision=Number(r.revision||revision+1);return r.state||state;}
  async function login(username,password){user=await Auth.login(username,password);return load();}
  async function logout(){await Auth.logout();revision=0;user=null;}
  async function password(oldPassword,newPassword){return Auth.changeOwnPassword(oldPassword,newPassword);}
  Object.assign(SK,{DB:{configured,connect,load,save,login,logout,password,get user(){return user||Auth?.currentUser()||null;}}});
})(globalThis.SK ||= {});
