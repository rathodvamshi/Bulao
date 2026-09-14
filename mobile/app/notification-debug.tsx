import React, { useState } from "react";
import { View, Text, Pressable, useWindowDimensions } from "react-native";
import { NotificationsScreen } from "../src/components/NotificationsScreen";

const items = [
  { id: "preview-new", type: "APPLICATION_CREATED", title: "New job application", message: "Arjun applied for your electrician job. Take a look at their profile and experience.", data: JSON.stringify({ jobId: "preview-job", workerId: "preview-worker" }), read: false, createdAt: Date.now() / 1000, recipientRole: "provider" },
  { id: "preview-bottom", type: "APPLICATION_CREATED", title: "Another seeker applied", message: "A new application is ready for review.", data: { jobId: "second-job", workerId: "second-worker" }, read: true, createdAt: Date.now() / 1000, recipientRole: "provider" },
  { id: "preview-accepted", type: "APPLICATION_ACCEPTED", title: "Your application was accepted!", message: "You've been selected for the electrician job. View the job to see the next steps.", data: { jobId: "accepted-job" }, read: false, createdAt: Date.now() / 1000, recipientRole: "seeker" },
];

export default function NotificationDebug() {
  const [role, setRole] = useState<'seeker' | 'provider'>('provider');
  const [width, setWidth] = useState(390);
  const [result, setResult] = useState('Ready');
  const size = useWindowDimensions();
  if (!__DEV__) return null;
  return <View style={{ flex: 1, alignItems: 'center', backgroundColor: '#DBE4DD' }}>
    <View style={{ flexDirection: 'row', padding: 8, gap: 12 }}>
      {(['provider','seeker'] as const).map(r => <Pressable key={r} onPress={() => { setRole(r); setResult('Ready'); }} style={{ padding: 8, backgroundColor: '#FFF' }}><Text>{r}</Text></Pressable>)}
      {[320,390,430].map(w => <Pressable key={w} onPress={() => setWidth(w)} style={{ padding: 8, backgroundColor: '#FFF' }}><Text>{w}</Text></Pressable>)}
      <Text accessibilityLiveRegion="polite">{result}</Text>
    </View>
    <View style={{ width, height: Math.min(760,size.height - 64), backgroundColor: '#FFF' }}>
      <NotificationsScreen key={role} role={role} onBack={() => setResult('Back')} onSelectJob={id => setResult('Job: '+id)} onSelectProfile={id => setResult('Profile: '+id)} />
    </View>
  </View>;
}
