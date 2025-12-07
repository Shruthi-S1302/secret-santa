import { Component } from '@angular/core';
import { Observable, startWith, Subject, switchMap } from 'rxjs';
import { People } from '../services/people';
import { Router } from '@angular/router';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';

@Component({
  selector: 'app-people-list',
  imports: [FormsModule, CommonModule],
  templateUrl: './people-list.html',
  styleUrl: './people-list.css',
})
export class PeopleList {
  singleName = '';
  stagedPeople: string[] = [];
  people$: Observable<string[]>;
  private refresh$ = new Subject<void>();

  constructor(private peopleService: People, private router: Router) {
    this.people$ = this.refresh$.pipe(
      startWith(undefined),
      switchMap(() => this.peopleService.loadPeople())
    );
  }

  loadPeople() {
    this.refresh$.next();
  }

  addToStaged() {
    const name = this.singleName.trim();
    if (!name) return;
    this.stagedPeople.push(name);
    this.singleName = '';
  }

  removeStaged(index: number) {
    this.stagedPeople.splice(index, 1);
  }

  addPeople() {
    if (this.stagedPeople.length === 0) return;

    this.peopleService.addPeople(this.stagedPeople).subscribe({
      next: () => {
        this.stagedPeople = [];
        this.loadPeople();
      },
      error: err => console.error('Failed to add people:', err)
    });
  }

  removePerson(name: string) {
    this.peopleService.removePersonByName(name).subscribe({
      next: () => this.loadPeople(),
      error: err => console.error('Failed to remove person:', err)
    });
  }

  goToPicker() {
    this.router.navigate(['/pick']);
  }
}