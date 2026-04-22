export class UserResponse {
    id: string
    firstname: string
    lastname: string
    phoneNumber: string
    email: string
    status: string
    role: string
    profileImage: string
    gender: string
    nationality: string
    dateOfBirth: Date
    createdAt: Date


  constructor(user: any) {
    this.id = user.id;
    this.firstname = user.firstname;
    this.lastname = user.lastname;
    this.email = user.email;
    this.phoneNumber = user.phoneNumber;
    this.role = user.role;
    this.dateOfBirth = user.dateOfBirth
    this.gender = user.gender;
    this.nationality = user.nationality;
    this.status = user.status;
    this.profileImage = user.profileImage;
    this.createdAt = user.createdAt;
  }
}