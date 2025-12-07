import { CommonModule } from '@angular/common';
import { Component, OnInit, inject, NgZone } from '@angular/core';
import { FormsModule } from '@angular/forms';
import {
  Firestore,
  collection,
  getDocs,
  addDoc,
  Timestamp,
  query,
  where
} from '@angular/fire/firestore';
import { environment } from '../../enviroment';

interface Chit {
  name: string;
  left: string;
  top: string;
  rot: string;
  revealed: boolean;
}

interface ChitPosition {
  left: number;
  top: number;
}

@Component({
  selector: 'app-picker',
  imports: [CommonModule, FormsModule],
  templateUrl: './picker.html',
  styleUrl: './picker.css',
})
export class Picker implements OnInit {

  yourName = '';
  started = false;
  people: string[] = [];
  chits: Chit[] = [];
  loading = false;
  alreadyHasReceiver = false;
  assignedReceiverName = '';

  private firestore = inject(Firestore);
  private ngZone = inject(NgZone);
  
  // Encryption key - In production, store this securely (environment variable, secure config, etc.)
  private readonly ENCRYPTION_KEY = environment.ASSIGNMENTS_ENCRYPTION_KEY;

  ngOnInit() {}

  // Check if two positions overlap
  private isOverlapping(pos1: ChitPosition, pos2: ChitPosition, minDistance: number = 18): boolean {
    const distance = Math.sqrt(
      Math.pow(pos1.left - pos2.left, 2) + 
      Math.pow(pos1.top - pos2.top, 2)
    );
    return distance < minDistance;
  }

  // Generate non-overlapping positions
  private generatePositions(count: number): ChitPosition[] {
    const positions: ChitPosition[] = [];
    const maxAttempts = 100;

    for (let i = 0; i < count; i++) {
      let attempts = 0;
      let validPosition = false;
      let newPos: ChitPosition = { left: 0, top: 0 };

      while (!validPosition && attempts < maxAttempts) {
        newPos = {
          left: 5 + Math.random() * 75,
          top: 5 + Math.random() * 75
        };

        // Check if this position overlaps with any existing position
        validPosition = positions.every(pos => !this.isOverlapping(newPos, pos));
        attempts++;
      }

      // If we couldn't find a non-overlapping position after max attempts,
      // use the last generated position anyway (rare case with many chits)
      positions.push(newPos);
    }

    return positions;
  }

  // Simple encryption using Web Crypto API
  private async encrypt(text: string): Promise<string> {
    const encoder = new TextEncoder();
    const data = encoder.encode(text);
    
    // Create a key from the encryption key string
    const keyMaterial = await crypto.subtle.importKey(
      'raw',
      encoder.encode(this.ENCRYPTION_KEY),
      { name: 'PBKDF2' },
      false,
      ['deriveBits', 'deriveKey']
    );
    
    const salt = crypto.getRandomValues(new Uint8Array(16));
    
    const key = await crypto.subtle.deriveKey(
      {
        name: 'PBKDF2',
        salt: salt,
        iterations: 100000,
        hash: 'SHA-256'
      },
      keyMaterial,
      { name: 'AES-GCM', length: 256 },
      false,
      ['encrypt']
    );
    
    const iv = crypto.getRandomValues(new Uint8Array(12));
    
    const encryptedData = await crypto.subtle.encrypt(
      { name: 'AES-GCM', iv: iv },
      key,
      data
    );
    
    // Combine salt + iv + encrypted data
    const combined = new Uint8Array(salt.length + iv.length + encryptedData.byteLength);
    combined.set(salt, 0);
    combined.set(iv, salt.length);
    combined.set(new Uint8Array(encryptedData), salt.length + iv.length);
    
    // Convert to base64 for storage
    return btoa(String.fromCharCode(...combined));
  }
  
  // Decryption function
  private async decrypt(encryptedText: string): Promise<string> {
    const encoder = new TextEncoder();
    
    // Decode from base64
    const combined = Uint8Array.from(atob(encryptedText), c => c.charCodeAt(0));
    
    // Extract salt, iv, and encrypted data
    const salt = combined.slice(0, 16);
    const iv = combined.slice(16, 28);
    const encryptedData = combined.slice(28);
    
    // Create key from encryption key string
    const keyMaterial = await crypto.subtle.importKey(
      'raw',
      encoder.encode(this.ENCRYPTION_KEY),
      { name: 'PBKDF2' },
      false,
      ['deriveBits', 'deriveKey']
    );
    
    const key = await crypto.subtle.deriveKey(
      {
        name: 'PBKDF2',
        salt: salt,
        iterations: 100000,
        hash: 'SHA-256'
      },
      keyMaterial,
      { name: 'AES-GCM', length: 256 },
      false,
      ['decrypt']
    );
    
    const decryptedData = await crypto.subtle.decrypt(
      { name: 'AES-GCM', iv: iv },
      key,
      encryptedData
    );
    
    const decoder = new TextDecoder();
    return decoder.decode(decryptedData);
  }

  start() {
    if (!this.yourName.trim()) return;
    this.started = true;
    this.loadData();
  }

  async loadData() {
    this.loading = true;

    try {
      // Encrypt the giver name for query
      const encryptedGiver = await this.encrypt(this.yourName);
      
      // Check if this giver already has a receiver
      const giverQuery = query(
        collection(this.firestore, 'assignments'),
        where('giver', '==', encryptedGiver)
      );
      const giverSnap = await getDocs(giverQuery);
      
      if (!giverSnap.empty) {
        // User already has an assignment - decrypt the receiver name
        const encryptedReceiver = giverSnap.docs[0].data()['receiver'];
        const decryptedReceiver = await this.decrypt(encryptedReceiver);
        
        this.ngZone.run(() => {
          this.alreadyHasReceiver = true;
          this.assignedReceiverName = decryptedReceiver;
          this.loading = false;
        });
        return;
      }

      // Get all people
      const peopleSnap = await getDocs(collection(this.firestore, 'people'));
      
      // Get ALL existing assignments
      const assignmentsSnap = await getDocs(collection(this.firestore, 'assignments'));
      
      // Decrypt all receivers to check who's already assigned
      const alreadyAssignedReceivers = await Promise.all(
        assignmentsSnap.docs.map(async (doc) => {
          const encryptedReceiver = doc.data()['receiver'];
          return await this.decrypt(encryptedReceiver);
        })
      );
      
      this.ngZone.run(() => {
        this.people = peopleSnap.docs.map(d => d.data()['name']);
        
        // Filter out: yourself and people already assigned to ANYONE
        const filtered = this.people.filter(
          p => p !== this.yourName && !alreadyAssignedReceivers.includes(p)
        );

        // Generate non-overlapping positions
        const positions = this.generatePositions(filtered.length);

        this.chits = filtered.map((name, index) => ({
          name,
          left: `${positions[index].left}%`,
          top: `${positions[index].top}%`,
          rot: `${-18 + Math.random() * 36}deg`,
          revealed: false
        }));
        
        this.loading = false;
      });

    } catch (error) {
      console.error('Error loading data:', error);
      this.ngZone.run(() => {
        this.loading = false;
      });
    }
  }

  async revealChit(chit: Chit) {
    if (chit.revealed) return;
    
    chit.revealed = true;

    try {
      // Encrypt both giver and receiver names before storing
      const encryptedGiver = await this.encrypt(this.yourName);
      const encryptedReceiver = await this.encrypt(chit.name);
      
      await addDoc(collection(this.firestore, 'assignments'), {
        giver: encryptedGiver,
        receiver: encryptedReceiver,
        revealedAt: Timestamp.now(),
        createdAt: Timestamp.now()
      });

      console.log(`Assignment created (encrypted): ${this.yourName} -> ${chit.name}`);
    } catch (error) {
      console.error('Error creating assignment:', error);
    }
  }
}