import AsyncStorage from '@react-native-async-storage/async-storage';
import { useEffect, useSyncExternalStore } from 'react';
import { apiBaseUrl } from './config';
import { fetchWithTimeout } from './network';

export type AppAsset = {id:string;groupName:string;url:string;width:number;height:number;revision:string};
const KEY='public-app-assets:v1';
let snapshot: Record<string,AppAsset> = {};
let refreshedAt=0;
let pending: Promise<void> | undefined;
const listeners=new Set<()=>void>();
const subscribe=(listener:()=>void)=>{listeners.add(listener);return()=>{listeners.delete(listener);};};
const getSnapshot=()=>snapshot;
function parse(value:unknown): Record<string,AppAsset> | null {
  if(!Array.isArray(value) || value.length>500) return null;
  const next:Record<string,AppAsset>={};
  for(const a of value) {
    if(!a || typeof a.id!=='string' || !/^[a-z0-9-]+$/.test(a.id) || next[a.id] || typeof a.revision!=='string'
      || typeof a.url!=='string' || !/^https:\/\/res\.cloudinary\.com\/japfuiuz\/image\/upload\//.test(a.url)
      || !Number.isFinite(a.width) || a.width<=0 || !Number.isFinite(a.height) || a.height<=0) return null;
    next[a.id]=a;
  }
  return next;
}
const publish=(next:Record<string,AppAsset>)=>{snapshot=next;listeners.forEach(fn=>fn());};
export function refreshAppAssets(): Promise<void> {
  if(pending) return pending;
  if(Date.now()-refreshedAt<300000) return Promise.resolve();
  pending=(async()=>{
    if(!Object.keys(snapshot).length) {
      try { const raw=await AsyncStorage.getItem(KEY);const cached=raw?parse(JSON.parse(raw)):null;if(cached)publish(cached); } catch {}
    }
    try {
      // Public metadata: no authentication dependency, no image bytes downloaded here.
      const response=await fetchWithTimeout(`${apiBaseUrl()}/assets`,{redirect:'error'},5000);
      if(!response.ok) return;
      const body=await response.json();const next=body.success?parse(body.data?.assets):null;
      if(!next) return;
      publish(next);refreshedAt=Date.now();
      await AsyncStorage.setItem(KEY,JSON.stringify(Object.values(next))).catch(()=>{});
    } catch { /* Cached artwork or the screen's plain background stays usable. */ }
  })().finally(()=>{pending=undefined;});
  return pending;
}
export function useAppAsset(id?:string) {
  const assets=useSyncExternalStore(subscribe,getSnapshot,getSnapshot);
  useEffect(()=>{if(id)void refreshAppAssets();},[id]);
  return id?assets[id]:undefined;
}
