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
    if (!confirm(`Are you sure you want to remove ${name}? Their assignments will also be deleted.`)) return;
    
    this.peopleService.removePersonAndAssignments(name).subscribe({
      next: () => {
        this.loadPeople();
        alert(`${name} and their assignments have been removed.`);
      },
      error: err => {
        console.error('Failed to remove person:', err);
        alert('Error removing person. Please try again.');
      }
    });
  }

  deleteAllPeople() {
    if (!confirm('⚠️ Are you sure you want to DELETE ALL PEOPLE? This cannot be undone!')) return;
    
    // Double confirmation for safety
    if (!confirm('This will permanently delete all people AND all assignments. Are you absolutely sure?')) return;

    this.peopleService.deleteAllPeopleAndAssignments().subscribe({
      next: () => {
        this.loadPeople();
        alert('All people and assignments have been deleted.');
      },
      error: err => {
        console.error('Failed to delete all people:', err);
        alert('Error deleting people. Please try again.');
      }
    });
  }

  deleteAllAssignments() {
    if (!confirm('⚠️ Are you sure you want to DELETE ALL ASSIGNMENTS? This cannot be undone!')) return;
    
    // Double confirmation for safety
    if (!confirm('This will permanently delete all Secret Santa assignments. Are you absolutely sure?')) return;

    this.peopleService.deleteAllAssignments().subscribe({
      next: () => {
        alert('All assignments have been deleted. People can now pick again.');
      },
      error: err => {
        console.error('Failed to delete all assignments:', err);
        alert('Error deleting assignments. Please try again.');
      }
    });
  }

  goToPicker() {
    this.router.navigate(['/pick']);
  }
}