import { Component, OnInit } from '@angular/core';
import { Router } from '@angular/router';
import { NotificationComponent } from '../notification/notification.component';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { HttpClientModule } from '@angular/common/http';
import { ApiService } from '../../Services/api.service';
import { UserService } from '../../Services/user.service';
import { Task, QuestionDetail } from '../../Models/Task.model';
import { InsertAnswer } from '../../Models/insert-answer.model';
import { PointsService } from '../../Services/points.service';
import Swal from 'sweetalert2';

@Component({
  selector: 'app-home',
  standalone: true,
  imports: [NotificationComponent, CommonModule, FormsModule, HttpClientModule],
  templateUrl: './home.component.html',
  styleUrls: ['./home.component.css'],
  providers: [ApiService]
})
export class HomeComponent implements OnInit {
  points: number = 0;
  missions: Array<any> = [];
  tasks: Task[] = [];
  selectedTask: Task | null = null;
  notificationVisible = false;
  selectedAnswer: string | null = null;

  constructor(
    private router: Router, 
    private apiService: ApiService, 
    private userService: UserService,
    private pointsService: PointsService
  ) {}

  ngOnInit() {
    this.pointsService.points$.subscribe(points => {
      this.points = points;
    });

    const missionId = this.userService.getMissionId();
    if (missionId !== null) {
      this.insertUserMission(missionId);
    } else {
      console.error('Mission ID is null. User might not be signed in.');
    }
    this.updateUserScore();
  }

  insertUserMission(missionId: number) {
    const userId = this.userService.getUserId();
    if (userId !== null) {
      const userMissionData = { id: missionId };
      console.log('Mission ID:', missionId);

      this.apiService.insertUserMission(userId, userMissionData).subscribe(
        response => {
          console.log('User mission inserted:', response);
          this.fetchTasksByMissionId(missionId);
        },
        error => {
          console.error('Error inserting user mission:', error);
        }
      );
    } else {
      console.error('User ID is null. User might not be signed in.');
    }
  }

  fetchTasksByMissionId(missionId: number) {
    const userId = this.userService.getUserId();
    if (userId !== null) {
      const taskData = { id: missionId };

      this.apiService.getTasksByMissionId(userId, taskData).subscribe(
        response => {
          this.tasks = response.map((task: any) => {
            task.Questions_Details = JSON.parse(task.Questions_Details) as QuestionDetail[];
            return task;
          });
        },
        error => {
          console.error('Error fetching tasks:', error);
        }
      );
    } else {
      console.error('User ID is null. User might not be signed in.');
    }
  }

  selectTask(task: Task) {
    this.selectedTask = task;
  }

  navigateBack() {
    this.selectedTask = null;
  }

  submitAnswer() {
    if (this.selectedTask && this.selectedAnswer) {
      const userId = this.userService.getUserId();
      const campId = this.userService.getCampaignId();
      const brandId = this.userService.getBrandId();
      
      if (userId !== null && campId !== null && brandId !== null) {
        const isCorrect = this.selectedAnswer === this.selectedTask.BX_Questions_Correct_Answer_EN;
        const pointsToAdd = isCorrect ? this.selectedTask.BX_Questions_Correct_Point : this.selectedTask.BX_Questions_Wrong_Point;

        const answerData: InsertAnswer = {
          BX_User_Questions_Mission_Mission_Questions_ID_FK: this.selectedTask.BX_Mission_Questions_ID_PK,
          BX_User_Questions_Mission_User_ID_FK: userId,
          BX_User_Questions_Mission_Answer: this.selectedAnswer,
          BX_User_Questions_Mission_Correct: isCorrect ? 1 : 0,
          BX_User_Score_Game_Type_ID_FK: 11,
          BX_User_Score_User_ID_FK: userId,
          BX_User_Score_Point: pointsToAdd,
          BX_User_Score_Comment: '',
          BX_User_Score_DateTime: new Date(),
          BX_User_Score_Camp_ID_FK: campId,
          BX_User_Score_Brand_ID_FK: brandId,
          BX_User_Score_Questions_Mission_ID_FK: this.selectedTask.BX_Questions_ID_PK
        };

        this.apiService.insertAnswer(userId, answerData).subscribe(
          response => {
            console.log('Answer submitted:', response);
            if (isCorrect) {
              this.pointsService.addPoints(pointsToAdd);
              this.updateUserScore();
            }
            Swal.fire({
              title: isCorrect ? 'Correct' : 'Incorrect',
              html: `
              <div style="position: relative;">
                <div class="icon-container">
                  <i class="swal2-icon swal2-${isCorrect ? 'success' : 'error'} swal2-icon-show" style="display: flex;"></i>
                </div>
                <img src="assets/img/alert.png" alt="Custom Image" style="width:100px; margin-bottom: 20px;">
                <p>You Gained <span style="color:gold; font-weight: bold;">${pointsToAdd} points</span></p>
                <button id="custom-button" style="border: none; background: none; cursor: pointer; padding: 0; position: relative;">
                  <img src="assets/img/button.png" alt="Continue Game" style="width: 200px; display: block; height: 60px;">
                  <span class="button-text m-auto" style="position: absolute; transform: translate(-50%, -50%); color: white; font-size: 14px; pointer-events: none; top: 50%; left: 50%;">Continue Game</span>
                </button>
              </div>
            `,
            showConfirmButton: false,
          }).then(() => {
            // Optional: You can handle additional actions after the alert is closed here
          });

          // Add event listener for custom button
          Swal.getHtmlContainer()?.querySelector('#custom-button')?.addEventListener('click', () => {
            Swal.close();
            this.selectedAnswer = null;
            this.selectedTask = null;
            this.refreshPage(); // Refresh the page after clicking "Done"
          });
      
          },
          error => {
            console.error('Error submitting answer:', error);
            Swal.fire({
              title: 'Error!',
              text: 'Error submitting answer.',
              icon: 'error',
              confirmButtonText: 'OK'
            });
          }
        );
      } else {
        console.error('User ID, Camp ID, or Brand ID is null. User might not be signed in.');
        Swal.fire({
          title: 'Error!',
          text: 'User ID, Camp ID, or Brand ID is null. Please sign in again.',
          icon: 'error',
          confirmButtonText: 'OK'
        });
      }
    } else {
      Swal.fire({
        title: 'Error!',
        text: 'Please select an answer.',
        icon: 'error',
        confirmButtonText: 'OK'
      });
    }
  }

  // Fetch updated score from the API
  updateUserScore() {
    const userId = this.userService.getUserId();
    const campId = this.userService.getCampaignId();

    if (userId !== null && campId !== null) {
      const DataCampId = { id: campId };
      this.apiService.getUserScoreByCampId(userId, DataCampId).subscribe(
        data => {
          const updatedScore = data[0]?.UserScore || 0;
          this.pointsService.setPoints(updatedScore);
          
        },
        error => {
          console.error('Error fetching updated score:', error);
        }
      );
    }
  }

  // Refresh the page
  refreshPage() {
    window.location.reload();
  }

  // Navigation and utility methods

  navigateToSignin() {
    this.router.navigate(['/signin']);
  }

  navigateToRewards() {
    this.router.navigate(['/rewards']);
  }

  navigateToHome() {
    this.router.navigate(['/home']);
  }

  navigateToMission() {
    this.router.navigate(['/mission']);
  }

  navigateToActivityTitle() {
    this.router.navigate(['/activity/title']);
  }

  navigateToRanking() {
    this.router.navigate(['/ranking']);
  }

  navigateToProfile() {
    this.router.navigate(['/profile']);
  }

  navigateToNotifications() {
    this.router.navigate(['/Notification']);
  }

  showNotifications(): void {
    this.notificationVisible = !this.notificationVisible;
  }

  onCloseNotification(): void {
    this.notificationVisible = false;
  }
}
