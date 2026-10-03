/* DilYol Firebase bridge */
let dlyAuth = null;
let dlyDb = null;
let dlyFirebaseError = "";

try {
  const app = firebase.apps.length ? firebase.app() : firebase.initializeApp({
    apiKey: "AIzaSyAwxUpcceXN6fOw0CBd0t2rDaWZc3Wy1Ak",
    authDomain: "learn-language-87525.firebaseapp.com",
    projectId: "learn-language-87525",
    storageBucket: "learn-language-87525.firebasestorage.app",
    messagingSenderId: "672110934440",
    appId: "1:672110934440:web:e36cc21e52cb070494459d",
    measurementId: "G-PVTXL7LSG4"
  });
  dlyAuth = firebase.auth();
  dlyDb = firebase.firestore();
  dlyAuth.setPersistence(firebase.auth.Auth.Persistence.LOCAL).catch(()=>{});
} catch (e) {
  dlyFirebaseError = e?.message || "Firebase başlatılamadı.";
}

window.DilYolFirebase = {
  user:null,
  ready:false,
  progress:null,
  error:dlyFirebaseError,
  async login(email,password){
    if (!dlyAuth) throw new Error(this.error || "Firebase bağlantısı kurulamadı.");
    return dlyAuth.signInWithEmailAndPassword(email,password);
  },
  async register(email,password,name){
    if (!dlyAuth) throw new Error(this.error || "Firebase bağlantısı kurulamadı.");
    const c=await dlyAuth.createUserWithEmailAndPassword(email,password);
    if(name) await c.user.updateProfile({displayName:name});
    return c;
  },
  async logout(){
    if(!dlyAuth) return;
    return dlyAuth.signOut();
  },
  async load(){
    if(!dlyAuth?.currentUser || !dlyDb) return null;
    const snap=await dlyDb.collection("users").doc(dlyAuth.currentUser.uid).get();
    return snap.exists ? snap.data() : null;
  },
  async save(progress){
    if(!dlyAuth?.currentUser || !dlyDb) return;
    await dlyDb.collection("users").doc(dlyAuth.currentUser.uid).set({
      ...progress,
      displayName:dlyAuth.currentUser.displayName||"",
      email:dlyAuth.currentUser.email||"",
      updatedAt:firebase.firestore.FieldValue.serverTimestamp()
    },{merge:true});
  }
};

if (dlyAuth) {
  dlyAuth.onAuthStateChanged(async user=>{
    window.DilYolFirebase.user=user;
    if(user){
      try {
        window.DilYolFirebase.progress=await window.DilYolFirebase.load();
      } catch(e){
        console.error("Firestore yükleme hatası:",e);
        window.DilYolFirebase.progress=null;
      }
      window.DilYolFirebase.ready=true;
      window.dispatchEvent(new Event("dilyol-auth-ready"));
    } else {
      window.DilYolFirebase.ready=true;
      window.dispatchEvent(new Event("dilyol-auth-signed-out"));
    }
  });
} else {
  window.DilYolFirebase.ready=true;
  window.dispatchEvent(new Event("dilyol-auth-signed-out"));
}
