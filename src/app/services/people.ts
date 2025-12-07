import { Injectable } from '@angular/core';
import { Firestore } from '@angular/fire/firestore';
import { addDoc, collection, deleteDoc, doc, getDocs } from 'firebase/firestore';
import { forkJoin, from, map, Observable, of, switchMap } from 'rxjs';

@Injectable({
  providedIn: 'root',
})
export class People {
  constructor(private firestore: Firestore) {}

  loadPeople(): Observable<string[]> {
    const ref = collection(this.firestore, 'people');
    return from(getDocs(ref)).pipe(map(snap => snap.docs.map(d => d.data()['name'])));
  }

  addPerson(name: string): Observable<void> {
    const ref = collection(this.firestore, 'people');
    return from(addDoc(ref, { name })).pipe(map(() => undefined));
  }

  addPeople(names: string[]): Observable<void> {
    if (!names || names.length === 0) return of(undefined);
    const ref = collection(this.firestore, 'people');
    const adds = names.map(name => from(addDoc(ref, { name })));
    return forkJoin(adds).pipe(map(() => undefined));
  }

  removePersonByName(name: string): Observable<void> {
    const ref = collection(this.firestore, 'people');
    return from(getDocs(ref)).pipe(
      switchMap(snap => {
        const deletes = snap.docs
          .filter(d => d.data()['name'] === name)
          .map(d => from(deleteDoc(doc(this.firestore, 'people', d.id))));
        if (deletes.length === 0) return of(undefined);
        return forkJoin(deletes).pipe(map(() => undefined));
      })
    );
  }
}