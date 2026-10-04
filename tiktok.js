// Overlaya Studio: TikTok LIVE connection (runs on the user's own PC)
const EventEmitter = require("events");

const clean = u => String(u || "").trim().replace(/^@/, "").replace(/^https?:\/\/(www\.)?tiktok\.com\/@/i, "").split(/[/?#\s]/)[0];

class TikTokManager extends EventEmitter {
  constructor(){
    super();
    this.conn = null; this.user = ""; this.key = ""; this.want = false;
    this.count = 0; this.state = "idle"; this.message = "Not connected";
    this.retry = null; this.lastStatus = 0;
  }
  status(){ return { state: this.state, message: this.message, count: this.count, user: this.user }; }
  setStatus(state, message){ this.state = state; this.message = message; this.emit("status", this.status()); }

  async start(user, key){
    await this.stop(true);
    this.user = clean(user); this.key = String(key || "").trim();
    if (!this.user){ this.setStatus("error", "Add your TikTok username first."); return; }
    this.want = true; this.count = 0;
    this.attempt();
  }

  async attempt(){
    if (!this.want) return;
    clearTimeout(this.retry);
    this.setStatus("connecting", "Connecting to @" + this.user + "...");
    let lib;
    try { lib = await import("tiktok-live-connector"); }
    catch (e){ this.setStatus("error", "The TikTok connection couldn't start. Reinstall Overlaya Studio."); return; }
    const { TikTokLiveConnection, WebcastEvent, ControlEvent, UserOfflineError } = lib;
    const opts = { processInitialData: false, enableExtendedGiftInfo: true };
    if (this.key) opts.signApiKey = this.key;
    let conn;
    try {
      conn = new TikTokLiveConnection(this.user, opts);
      this.conn = conn;
      const fwd = type => data => {
        if (this.conn !== conn) return;
        this.count++;
        this.emit("event", { type, data });
        if (this.state !== "live") this.setStatus("live", "Connected to your LIVE.");
        else if (Date.now() - this.lastStatus > 1000){ this.lastStatus = Date.now(); this.emit("status", this.status()); }
      };
      conn.on(WebcastEvent.CHAT, fwd("WebcastChatMessage"));
      conn.on(WebcastEvent.GIFT, fwd("WebcastGiftMessage"));
      conn.on(WebcastEvent.LIKE, fwd("WebcastLikeMessage"));
      conn.on(WebcastEvent.FOLLOW, fwd("Follow"));
      conn.on(WebcastEvent.SHARE, fwd("Share"));
      conn.on(WebcastEvent.SUB_NOTIFY, fwd("WebcastSubNotifyMessage"));
      conn.on(WebcastEvent.STREAM_END, () => { if (this.conn === conn) this.lost("Your LIVE ended. Waiting for your next LIVE.", 20000); });
      conn.on(ControlEvent.DISCONNECTED, () => { if (this.conn === conn && this.want) this.lost("Connection dropped. Reconnecting...", 5000); });
      conn.on(ControlEvent.ERROR, () => {});
      await conn.connect();
      if (this.conn !== conn){ try { await conn.disconnect(); } catch (e) {} return; }
      this.setStatus("live", "Connected to your LIVE.");
    } catch (err){
      if (this.conn === conn) this.conn = null;
      if (!this.want) return;
      const msg = String((err && (err.message || err)) || "");
      const offline = (UserOfflineError && err instanceof UserOfflineError) || /offline|not live|isn.t live|live has ended|status.*4/i.test(msg);
      if (offline){ this.setStatus("waiting", "You're not live yet. Checking again every 20 seconds."); this.later(20000); }
      else if (/room ?id/i.test(msg)){ this.setStatus("waiting", "Can't find a LIVE for @" + this.user + " yet. Start your LIVE, or double-check your username. Checking again every 20 seconds."); this.later(20000); }
      else if (/ENOTFOUND|ECONNREFUSED|ETIMEDOUT|network|socket hang up/i.test(msg)){ this.setStatus("error", "Can't reach TikTok. Check your internet connection. Trying again..."); this.later(15000); }
      else if (/rate|429|too many/i.test(msg)){ this.setStatus("error", "TikTok is busy. Trying again in a minute."); this.later(60000); }
      else if (/unique|user.*not.*found|invalid/i.test(msg)){ this.setStatus("error", "Couldn't find @" + this.user + ". Check your username."); this.want = false; }
      else { this.setStatus("error", "Couldn't connect yet (" + msg.slice(0, 80) + "). Trying again..."); this.later(15000); }
    }
  }

  lost(message, ms){
    const c = this.conn; this.conn = null;
    if (c){ try { c.disconnect(); } catch (e) {} }
    this.setStatus("waiting", message);
    this.later(ms);
  }
  later(ms){ clearTimeout(this.retry); if (this.want) this.retry = setTimeout(() => this.attempt(), ms); }

  async stop(silent){
    this.want = false; clearTimeout(this.retry);
    const c = this.conn; this.conn = null;
    if (c){ try { await c.disconnect(); } catch (e) {} }
    if (!silent) this.setStatus("idle", "Not connected");
  }
}

/* Fake LIVE for testing the app without going live */
class SimulatedManager extends TikTokManager {
  async start(user){
    await this.stop(true);
    this.user = clean(user) || "you"; this.want = true; this.count = 0;
    this.setStatus("connecting", "Connecting to @" + this.user + "...");
    setTimeout(() => this.setStatus("live", "Connected to your LIVE (test mode)."), 600);
    const script = [
      ["WebcastChatMessage", { user: { uniqueId: "mika", nickname: "Mika" }, comment: "hello from the desktop app!", userIdentity: { isSubscriberOfAnchor: true } }],
      ["Follow", { user: { uniqueId: "kai", nickname: "Kai" } }],
      ["WebcastGiftMessage", { user: { uniqueId: "bea", nickname: "Bea" }, repeatCount: 12, repeatEnd: 1, giftDetails: { giftName: "Rose", diamondCount: 1, giftType: 1 } }],
      ["WebcastLikeMessage", { user: { uniqueId: "lia", nickname: "Lia" }, likeCount: 140, totalLikeCount: 1200 }],
    ];
    let i = 0;
    const tick = () => {
      if (!this.want) return;
      const [type, data] = script[i++ % script.length];
      this.count++; this.emit("event", { type, data }); this.emit("status", this.status());
      this.retry = setTimeout(tick, 2500);
    };
    this.retry = setTimeout(tick, 1500);
  }
}

module.exports = { TikTokManager, SimulatedManager, clean };
