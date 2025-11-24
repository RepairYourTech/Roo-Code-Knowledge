import {
	extractAngularComponentMetadata,
	extractAngularServiceMetadata,
	extractAngularModuleMetadata,
	extractAngularRoutingMetadata,
	extractAngularFormMetadata,
	extractAngularHttpMetadata,
	extractAngularRxJSMetadata,
	extractAngularTestMetadata,
} from "../../code-index/processors/metadata-extractor"
import { Node } from "web-tree-sitter"

describe("Angular Pattern Detection", () => {
	describe("Angular Component Metadata", () => {
		it("should extract component metadata from @Component decorator", () => {
			const mockNode = {
				type: "class_declaration",
				text: `
					@Component({
						selector: 'app-user-profile',
						templateUrl: './user-profile.component.html',
						styleUrls: ['./user-profile.component.scss'],
						changeDetection: ChangeDetectionStrategy.OnPush
					})
					export class UserProfileComponent {
						@Input() user: User
						@Output() userUpdated = new EventEmitter<User>()
						
						ngOnInit() {
							console.log('Component initialized')
						}
					}
				`,
				childForFieldName: (() => null) as any,
				children: [],
				parent: null,
				startPosition: { row: 0, column: 0 },
				endPosition: { row: 0, column: 0 },
				id: 1,
			} as unknown as Node

			const metadata = extractAngularComponentMetadata(mockNode, "test content")

			expect(metadata).toBeDefined()
			expect(metadata?.componentType).toBe("component")
			expect(metadata?.selector).toBe("app-user-profile")
			expect(metadata?.templateUrl).toBe("./user-profile.component.html")
			expect(metadata?.changeDetection).toBe("OnPush")
			expect(metadata?.inputs).toContain("user")
			expect(metadata?.outputs).toContain("userUpdated")
			expect(metadata?.lifecycleHooks).toContain("ngOnInit")
		})

		it("should extract directive metadata from @Directive decorator", () => {
			const mockNode = {
				type: "class_declaration",
				text: `
					@Directive({
						selector: '[appHighlight]'
					})
					export class HighlightDirective {
						@HostBinding('style.backgroundColor') backgroundColor: string
						
						@HostListener('mouseenter') onMouseEnter() {
							this.backgroundColor = 'yellow'
						}
					}
				`,
				childForFieldName: (() => null) as any,
				children: [],
				parent: null,
				startPosition: { row: 0, column: 0 },
				endPosition: { row: 0, column: 0 },
				id: 1,
			} as unknown as Node

			const metadata = extractAngularComponentMetadata(mockNode, "test content")

			expect(metadata).toBeDefined()
			expect(metadata?.componentType).toBe("directive")
			expect(metadata?.selector).toBe("[appHighlight]")
			expect(metadata?.hostBindings).toContain("style.backgroundColor")
			expect(metadata?.hostListeners).toContain("mouseenter")
		})

		it("should extract pipe metadata from @Pipe decorator", () => {
			const mockNode = {
				type: "class_declaration",
				text: `
					@Pipe({
						name: 'capitalize'
					})
					export class CapitalizePipe implements PipeTransform {
						transform(value: string): string {
							return value.charAt(0).toUpperCase() + value.slice(1)
						}
					}
				`,
				childForFieldName: (() => null) as any,
				children: [],
				parent: null,
				startPosition: { row: 0, column: 0 },
				endPosition: { row: 0, column: 0 },
				id: 1,
			} as unknown as Node

			const metadata = extractAngularComponentMetadata(mockNode, "test content")

			expect(metadata).toBeDefined()
			expect(metadata?.componentType).toBe("pipe")
		})
	})

	describe("Angular Service Metadata", () => {
		it("should extract service metadata from @Injectable decorator", () => {
			const mockNode = {
				type: "class_declaration",
				text: `
					@Injectable({
						providedIn: 'root'
					})
					export class UserService {
						constructor(private http: HttpClient) {}
						
						getUser(id: string): Observable<User> {
							return this.http.get<User>(\`/api/users/\${id}\`)
						}
					}
				`,
				childForFieldName: (() => null) as any,
				children: [],
				parent: null,
				startPosition: { row: 0, column: 0 },
				endPosition: { row: 0, column: 0 },
				id: 1,
			} as unknown as Node

			const metadata = extractAngularServiceMetadata(mockNode, "test content")

			expect(metadata).toBeDefined()
			expect(metadata?.serviceType).toBe("service")
			expect(metadata?.providedIn).toBe("root")
			expect(metadata?.constructorDependencies).toContain("HttpClient")
			expect(metadata?.methods).toContain("getUser")
		})

		it("should extract interceptor metadata from @Injectable decorator with HttpInterceptor", () => {
			const mockNode = {
				type: "class_declaration",
				text: `
					@Injectable()
					export class AuthInterceptor implements HttpInterceptor {
						intercept(req: HttpRequest<any>, next: HttpHandler): Observable<HttpEvent<any>> {
							const authReq = req.clone({
								headers: req.headers.set('Authorization', \`Bearer \${this.token}\`)
							})
							return next.handle(authReq)
						}
					}
				`,
				childForFieldName: (() => null) as any,
				children: [],
				parent: null,
				startPosition: { row: 0, column: 0 },
				endPosition: { row: 0, column: 0 },
				id: 1,
			} as unknown as Node

			const metadata = extractAngularServiceMetadata(mockNode, "test content")

			expect(metadata).toBeDefined()
			expect(metadata?.serviceType).toBe("interceptor")
		})
	})

	describe("Angular Module Metadata", () => {
		it("should extract root module metadata from @NgModule decorator", () => {
			const mockNode = {
				type: "class_declaration",
				text: `
					@NgModule({
						declarations: [AppComponent, HeaderComponent],
						imports: [BrowserModule, HttpClientModule],
						providers: [UserService],
						bootstrap: [AppComponent]
					})
					export class AppModule {}
				`,
				childForFieldName: (() => null) as any,
				children: [],
				parent: null,
				startPosition: { row: 0, column: 0 },
				endPosition: { row: 0, column: 0 },
				id: 1,
			} as unknown as Node

			const metadata = extractAngularModuleMetadata(mockNode, "test content")

			expect(metadata).toBeDefined()
			expect(metadata?.moduleType).toBe("root")
			expect(metadata?.declarations).toContain("AppComponent")
			expect(metadata?.imports).toContain("BrowserModule")
			expect(metadata?.providers).toContain("UserService")
			expect(metadata?.bootstrap).toContain("AppComponent")
		})

		it("should extract feature module metadata from @NgModule decorator", () => {
			const mockNode = {
				type: "class_declaration",
				text: `
					@NgModule({
						declarations: [UserComponent, UserService],
						imports: [CommonModule, ReactiveFormsModule],
						exports: [UserComponent]
					})
					export class UserModule {}
				`,
				childForFieldName: (() => null) as any,
				children: [],
				parent: null,
				startPosition: { row: 0, column: 0 },
				endPosition: { row: 0, column: 0 },
				id: 1,
			} as unknown as Node

			const metadata = extractAngularModuleMetadata(mockNode, "test content")

			expect(metadata).toBeDefined()
			expect(metadata?.moduleType).toBe("feature")
			expect(metadata?.declarations).toContain("UserComponent")
			expect(metadata?.exports).toContain("UserComponent")
		})

		it("should extract routing module metadata from @NgModule decorator", () => {
			const mockNode = {
				type: "class_declaration",
				text: `
					@NgModule({
						imports: [RouterModule.forRoot(routes)]
					})
					export class AppRoutingModule {}
				`,
				childForFieldName: (() => null) as any,
				children: [],
				parent: null,
				startPosition: { row: 0, column: 0 },
				endPosition: { row: 0, column: 0 },
				id: 1,
			} as unknown as Node

			const metadata = extractAngularModuleMetadata(mockNode, "test content")

			expect(metadata).toBeDefined()
			expect(metadata?.moduleType).toBe("routing")
			expect(metadata?.forRoot).toBe(true)
		})
	})

	describe("Angular Routing Metadata", () => {
		it("should extract route configuration metadata", () => {
			const mockNode = {
				type: "assignment_expression",
				text: `
					const routes: Routes = [
						{
							path: 'users/:id',
							component: UserComponent,
							canActivate: [AuthGuard],
							resolve: {
								user: UserResolver
							},
							data: {
								title: 'User Profile'
							}
						},
						{
							path: 'lazy',
							loadChildren: () => import('./lazy/lazy.module').then(m => m.LazyModule)
						}
					]
				`,
				childForFieldName: (() => null) as any,
				children: [],
				parent: null,
				startPosition: { row: 0, column: 0 },
				endPosition: { row: 0, column: 0 },
				id: 1,
			} as unknown as Node

			const metadata = extractAngularRoutingMetadata(mockNode, "test content")

			expect(metadata).toBeDefined()
			expect(metadata?.routeType).toBe("router-configuration")
			expect(metadata?.path).toBe("users/:id")
			expect(metadata?.component).toBe("UserComponent")
			expect(metadata?.canActivate).toContain("AuthGuard")
			expect(metadata?.resolve).toEqual({ user: "UserResolver" })
			expect(metadata?.data).toEqual({ title: "User Profile" })
			expect(metadata?.isDynamic).toBe(true)
			expect(metadata?.parameters).toContain("id")
		})

		it("should extract lazy loading route metadata", () => {
			const mockNode = {
				type: "assignment_expression",
				text: `
					const routes: Routes = [
						{
							path: 'admin',
							loadChildren: './admin/admin.module#AdminModule'
						}
					]
				`,
				childForFieldName: (() => null) as any,
				children: [],
				parent: null,
				startPosition: { row: 0, column: 0 },
				endPosition: { row: 0, column: 0 },
				id: 1,
			} as unknown as Node

			const metadata = extractAngularRoutingMetadata(mockNode, "test content")

			expect(metadata).toBeDefined()
			expect(metadata?.isLazyLoaded).toBe(true)
			expect(metadata?.loadChildren).toBe("./admin/admin.module#AdminModule")
		})
	})

	describe("Angular Form Metadata", () => {
		it("should extract reactive form metadata", () => {
			const mockNode = {
				type: "class_declaration",
				text: `
					export class UserFormComponent implements OnInit {
						userForm: FormGroup
						
						constructor(private fb: FormBuilder) {}
						
						ngOnInit() {
							this.userForm = this.fb.group({
								name: ['', Validators.required],
								email: ['', [Validators.required, Validators.email]]
							})
						}
						
						onSubmit() {
							if (this.userForm.valid) {
								console.log('Form submitted', this.userForm.value)
							}
						}
					}
				`,
				childForFieldName: (() => null) as any,
				children: [],
				parent: null,
				startPosition: { row: 0, column: 0 },
				endPosition: { row: 0, column: 0 },
				id: 1,
			} as unknown as Node

			const metadata = extractAngularFormMetadata(mockNode, "test content")

			expect(metadata).toBeDefined()
			expect(metadata?.formType).toBe("reactive")
			expect(metadata?.formGroup).toBe("userForm")
			expect(metadata?.validators).toContain("required")
			expect(metadata?.validators).toContain("email")
			expect(metadata?.submitMethod).toBe("onSubmit")
		})

		it("should extract template-driven form metadata", () => {
			const mockNode = {
				type: "class_declaration",
				text: `
					export class UserFormComponent {
						user = {
							name: '',
							email: ''
						}
						
						onSubmit(form: NgForm) {
							if (form.valid) {
								console.log('Form submitted', this.user)
							}
						}
					}
				`,
				childForFieldName: (() => null) as any,
				children: [],
				parent: null,
				startPosition: { row: 0, column: 0 },
				endPosition: { row: 0, column: 0 },
				id: 1,
			} as unknown as Node

			const metadata = extractAngularFormMetadata(mockNode, "test content containing ngModel and NgForm")

			expect(metadata).toBeDefined()
			expect(metadata?.formType).toBe("template-driven")
		})
	})

	describe("Angular HTTP Metadata", () => {
		it("should extract HTTP service metadata", () => {
			const mockNode = {
				type: "class_declaration",
				text: `
					@Injectable({
						providedIn: 'root'
					})
					export class ApiService {
						constructor(private http: HttpClient) {}
						
						getData(): Observable<any> {
							return this.http.get('/api/data')
						}
						
						postData(data: any): Observable<any> {
							return this.http.post('/api/data', data, {
								headers: new HttpHeaders({ 'Content-Type': 'application/json' }),
								params: new HttpParams({ 'cache': 'true' })
							})
						}
					}
				`,
				childForFieldName: (() => null) as any,
				children: [],
				parent: null,
				startPosition: { row: 0, column: 0 },
				endPosition: { row: 0, column: 0 },
				id: 1,
			} as unknown as Node

			const metadata = extractAngularHttpMetadata(mockNode, "test content")

			expect(metadata).toBeDefined()
			expect(metadata?.httpType).toBe("service")
			expect(metadata?.methods).toContain("get")
			expect(metadata?.methods).toContain("post")
			expect(metadata?.endpoints).toContain("/api/data")
		})

		it("should extract HTTP interceptor metadata", () => {
			const mockNode = {
				type: "class_declaration",
				text: `
					@Injectable()
					export class LoggingInterceptor implements HttpInterceptor {
						intercept(req: HttpRequest<any>, next: HttpHandler): Observable<HttpEvent<any>> {
							console.log('Request made:', req)
							return next.handle(req)
						}
					}
				`,
				childForFieldName: (() => null) as any,
				children: [],
				parent: null,
				startPosition: { row: 0, column: 0 },
				endPosition: { row: 0, column: 0 },
				id: 1,
			} as unknown as Node

			const metadata = extractAngularHttpMetadata(mockNode, "test content")

			expect(metadata).toBeDefined()
			expect(metadata?.httpType).toBe("interceptor")
		})
	})

	describe("Angular RxJS Metadata", () => {
		it("should extract Observable and Subject metadata", () => {
			const mockNode = {
				type: "class_declaration",
				text: `
					export class DataService {
						private dataSubject = new BehaviorSubject<any>(null)
						public data$ = this.dataSubject.asObservable()
						
						constructor() {
							this.data$.pipe(
								take(1),
								map(data => data?.value),
								catchError(error => of(null))
							).subscribe()
						}
						
						updateData(newData: any) {
							this.dataSubject.next(newData)
						}
					}
				`,
				childForFieldName: (() => null) as any,
				children: [],
				parent: null,
				startPosition: { row: 0, column: 0 },
				endPosition: { row: 0, column: 0 },
				id: 1,
			} as unknown as Node

			const metadata = extractAngularRxJSMetadata(mockNode, "test content")

			expect(metadata).toBeDefined()
			expect(metadata?.observableType).toBe("behavior-subject")
			expect(metadata?.operators).toContain("take")
			expect(metadata?.operators).toContain("map")
			expect(metadata?.operators).toContain("catchError")
			expect(metadata?.cold).toBe(true)
		})

		it("should extract hot Observable metadata", () => {
			const mockNode = {
				type: "class_declaration",
				text: `
					export class HotService {
						private hotSubject = new Subject<any>()
						public hot$ = this.hotSubject.pipe(share())
					}
				`,
				childForFieldName: (() => null) as any,
				children: [],
				parent: null,
				startPosition: { row: 0, column: 0 },
				endPosition: { row: 0, column: 0 },
				id: 1,
			} as unknown as Node

			const metadata = extractAngularRxJSMetadata(mockNode, "test content")

			expect(metadata).toBeDefined()
			expect(metadata?.hot).toBe(true)
			expect(metadata?.multicast).toBe(true)
		})
	})

	describe("Angular Test Metadata", () => {
		it("should extract unit test metadata", () => {
			const mockNode = {
				type: "call_expression",
				text: `
					describe('UserService', () => {
						let service: UserService
						let httpMock: HttpClientTestingModule

						beforeEach(() => {
							TestBed.configureTestingModule({
								providers: [UserService, { provide: HttpClient, useValue: httpMock }]
							})
							service = TestBed.inject(UserService)
						})

						it('should create service', () => {
							expect(service).toBeTruthy()
						})

						it('should get user data', () => {
							spyOn(service, 'getUser').and.returnValue(of(mockUser))
							service.getUser('1').subscribe(user => {
								expect(user).toEqual(mockUser)
							})
						})
					})
				`,
				childForFieldName: (() => null) as any,
				children: [],
				parent: null,
				startPosition: { row: 0, column: 0 },
				endPosition: { row: 0, column: 0 },
				id: 1,
			} as unknown as Node

			const metadata = extractAngularTestMetadata(mockNode, "test content")

			expect(metadata).toBeDefined()
			expect(metadata?.testType).toBe("unit")
			expect(metadata?.testBed).toBeDefined()
			expect(metadata?.describe).toContain("UserService")
			expect(metadata?.it).toContain("should create service")
			expect(metadata?.it).toContain("should get user data")
			expect(metadata?.spyOn).toContain("service")
			expect(metadata?.beforeEach).toContain("beforeEach")
		})

		it("should extract integration test metadata", () => {
			const mockNode = {
				type: "call_expression",
				text: `
					describe('UserComponent Integration', () => {
						let component: UserComponent
						let fixture: ComponentFixture<UserComponent>

						beforeEach(async () => {
							await TestBed.configureTestingModule({
								declarations: [UserComponent],
								imports: [HttpClientTestingModule, ReactiveFormsModule]
							}).compileComponents()

							fixture = TestBed.createComponent(UserComponent)
							component = fixture.componentInstance
							fixture.detectChanges()
						})

						it('should render user form', () => {
							expect(component).toBeTruthy()
						})
					})
				`,
				childForFieldName: (() => null) as any,
				children: [],
				parent: null,
				startPosition: { row: 0, column: 0 },
				endPosition: { row: 0, column: 0 },
				id: 1,
			} as unknown as Node

			const metadata = extractAngularTestMetadata(mockNode, "test content")

			expect(metadata).toBeDefined()
			expect(metadata?.testType).toBe("integration")
			expect(metadata?.fixtures).toContain("fixture")
		})
	})
})
