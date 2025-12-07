import { Routes } from '@angular/router';
import { PeopleList } from './people-list/people-list';
import { Picker } from './picker/picker';

export const routes: Routes = [
    { path: '', component: PeopleList },
    { path: 'pick', component: Picker }
];
