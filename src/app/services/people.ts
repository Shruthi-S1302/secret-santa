import { Injectable, inject } from '@angular/core';
import { 
  Firestore, 
  collection, 
  addDoc, 
  getDocs, 
  deleteDoc, 
  doc,
  query,
  where
} from '@angular/fire/firestore';
import { from, map, Observable, forkJoin, of } from 'rxjs';
import { switchMap } from 'rxjs/operators';
import { environment } from '../../environment';

@Injectable({
  providedIn: 'root'
})
export class People {
  private firestore = inject(Firestore);
  private readonly ENCRYPTION_KEY = environment.ASSIGNMENTS_ENCRYPTION_KEY;

  loadPeople(): Observable<string[]> {
    return from(getDocs(collection(this.firestore, 'people'))).pipe(
      map(snapshot => snapshot.docs.map(d => d.data()['name'] as string))
    );
  }

  addPeople(names: string[]): Observable<void> {
    const promises = names.map(name => 
      addDoc(collection(this.firestore, 'people'), { name })
    );
    return from(Promise.all(promises).then(() => undefined));
  }

  private async encrypt(text: string): Promise<string> {
    const encoder = new TextEncoder();
    const data = encoder.encode(text);
    
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
    
    const combined = new Uint8Array(salt.length + iv.length + encryptedData.byteLength);
    combined.set(salt, 0);
    combined.set(iv, salt.length);
    combined.set(new Uint8Array(encryptedData), salt.length + iv.length);
    
    return btoa(String.fromCharCode(...combined));
  }

  private async decrypt(encryptedText: string): Promise<string> {
    const encoder = new TextEncoder();
    
    const combined = Uint8Array.from(atob(encryptedText), c => c.charCodeAt(0));
    
    const salt = combined.slice(0, 16);
    const iv = combined.slice(16, 28);
    const encryptedData = combined.slice(28);
    
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

  // Delete assignments related to a specific person (as giver or receiver)
  private async deleteAssignmentsForPerson(name: string): Promise<void> {
    const encryptedName = await this.encrypt(name);
    const assignmentsSnap = await getDocs(collection(this.firestore, 'assignments'));
    
    const deletePromises: Promise<void>[] = [];
    
    for (const docSnap of assignmentsSnap.docs) {
      const data = docSnap.data();
      
      // Check if this person is either the giver or receiver
      if (data['giver'] === encryptedName || data['receiver'] === encryptedName) {
        deletePromises.push(deleteDoc(doc(this.firestore, 'assignments', docSnap.id)));
      }
    }
    
    await Promise.all(deletePromises);
  }

  removePersonAndAssignments(name: string): Observable<void> {
    return from(
      // First delete assignments
      this.deleteAssignmentsForPerson(name)
        .then(() => 
          // Then delete the person
          getDocs(query(collection(this.firestore, 'people'), where('name', '==', name)))
        )
        .then(snapshot => {
          const deletePromises = snapshot.docs.map(d => 
            deleteDoc(doc(this.firestore, 'people', d.id))
          );
          return Promise.all(deletePromises);
        })
        .then(() => undefined)
    );
  }

  deleteAllPeopleAndAssignments(): Observable<void> {
    return from(
      // First delete all assignments
      getDocs(collection(this.firestore, 'assignments'))
        .then(snapshot => {
          const deletePromises = snapshot.docs.map(d => 
            deleteDoc(doc(this.firestore, 'assignments', d.id))
          );
          return Promise.all(deletePromises);
        })
        .then(() => 
          // Then delete all people
          getDocs(collection(this.firestore, 'people'))
        )
        .then(snapshot => {
          const deletePromises = snapshot.docs.map(d => 
            deleteDoc(doc(this.firestore, 'people', d.id))
          );
          return Promise.all(deletePromises);
        })
        .then(() => undefined)
    );
  }

  deleteAllAssignments(): Observable<void> {
    return from(
      getDocs(collection(this.firestore, 'assignments'))
        .then(snapshot => {
          const deletePromises = snapshot.docs.map(d => 
            deleteDoc(doc(this.firestore, 'assignments', d.id))
          );
          return Promise.all(deletePromises);
        })
        .then(() => undefined)
    );
  }
}