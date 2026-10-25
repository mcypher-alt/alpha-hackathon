import { CanActivate, ExecutionContext, HttpException, Injectable } from '@nestjs/common';
import type { Request } from 'express';

@Injectable()
export class AuthRateGuard implements CanActivate {
  private attempts=new Map<string,{count:number;until:number}>();
  canActivate(context:ExecutionContext) {
    const req=context.switchToHttp().getRequest<Request>();
    const key=req.ip??'unknown',now=Date.now();
    if(this.attempts.size>10000)for(const [k,v]of this.attempts)if(v.until<now)this.attempts.delete(k);
    let entry=this.attempts.get(key);
    if(!entry||entry.until<now){entry={count:0,until:now+60000};this.attempts.set(key,entry);}
    if(++entry.count>40)throw new HttpException('Слишком много попыток. Повторите через минуту.',429);
    return true;
  }
}
