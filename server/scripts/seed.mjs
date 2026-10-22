import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcrypt';
import { MlMockService } from '../dist/applications/ml-mock.service.js';
import { PRODUCT_CATALOG } from '../dist/applications/catalog.js';

if(process.env.SEED_DEMO!=='true') {console.log('Demo seeding disabled (set SEED_DEMO=true).');process.exit(0);}
const prisma=new PrismaClient();
try {
  const hash=await bcrypt.hash('AlfaDemo2026!',10);
  const client=await prisma.user.upsert({where:{phone:'+79990000001'},update:{passwordHash:hash,role:'CLIENT'},create:{phone:'+79990000001',passwordHash:hash,fullName:'Алексей Смирнов',position:'Собственник бизнеса',role:'CLIENT'}});
  await prisma.user.upsert({where:{phone:'+79990000002'},update:{passwordHash:hash,role:'UNDERWRITER'},create:{phone:'+79990000002',passwordHash:hash,fullName:'Мария Волкова',position:'Кредитный аналитик',role:'UNDERWRITER'}});
  for(const p of PRODUCT_CATALOG)await prisma.creditProduct.upsert({where:{code:p.code},update:{},create:{code:p.code,title:p.title,description:'Учебный каталог 21.10.2026; не оферта банка',minAmount:p.min??0,maxAmount:p.max,minTermMonths:p.minTerm,maxTermMonths:p.maxTerm,baseRate:p.baseRate,minScoringScore:700}});
  const product=await prisma.creditProduct.findUniqueOrThrow({where:{code:'K1'}}),ml=new MlMockService();
  const fixtures=[{preset:'medium',suffix:'101',status:'MANUAL_REVIEW',note:'Демонстрационный сценарий ручного анализа: уточните сезонность поступлений.'},{preset:'good',suffix:'102',status:'APPROVED',note:'Демонстрационный сценарий одобрения: примите условия и подпишите учебный договор.'},{preset:'risky',suffix:'103',status:'REJECTED',note:'Демонстрационный отказ: действующие платежи превышают денежный поток.'}];
  for(const f of fixtures){
    const profile=ml.getGosuslugiEgrulProfile(f.preset);
    const {source,simulated,...profileData}=profile;
    const company=await prisma.company.upsert({where:{inn:profile.inn},update:{},create:{...profileData,userId:client.id,registrationDate:new Date(profile.registrationDate)}});
    const input={productCode:'K1',requestedAmount:3000000,requestedTermMonths:36,monthlyRevenue:profile.monthlyRevenue,monthlyExpenses:profile.monthlyExpenses,currentDebtLoad:profile.currentDebtLoad,registrationDate:new Date(profile.registrationDate)};
    const result=ml.evaluateApplication(input);
    const snapshot=JSON.parse(JSON.stringify({...input,answers:{purpose:'equipment',collateral:'no'},consent:true,consentAt:'2026-10-22T00:00:00Z',seeded:true}));
    await prisma.loanApplication.upsert({where:{id:`00000000-0000-4000-8000-000000000${f.suffix}`},update:{},create:{id:`00000000-0000-4000-8000-000000000${f.suffix}`,companyId:company.id,productId:product.id,requestedAmount:3000000,requestedTermMonths:36,purpose:f.preset==='medium'?'Закупка товаров для маркетплейса':'Обновление оборудования',status:f.status,scoringScore:result.scoringScore,riskGrade:result.riskGrade,enrichmentData:result.enrichmentData,scoringFactors:{...result.scoringFactors,applicationSnapshot:snapshot,seeded:true},financialSnapshot:snapshot,approvedAmount:f.status==='REJECTED'?0:3000000,approvedTermMonths:36,approvedRate:f.status==='REJECTED'?0:21.5,decisionNote:f.note,statusHistory:{create:[{fromStatus:'DRAFT',toStatus:'SUBMITTED',actorRole:'CLIENT',changedById:client.id,comment:'Синтетическая демонстрационная заявка.'},{fromStatus:'SUBMITTED',toStatus:f.status,actorRole:'ADMIN',comment:f.note}]}}});
  }
  console.log('Synthetic demo accounts and three application fixtures are ready. Existing application changes preserved.');
} finally {await prisma.$disconnect();}
